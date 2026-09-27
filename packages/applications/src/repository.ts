/**
 * Persistence for the application lifecycle: one Application per (profile,
 * job) with an immutable ApplicationEvent trail. Every state change flows
 * through this layer and is mirrored into the cross-cutting AuditLog
 * (docs/architecture/threat-model.md). Prisma errors are translated into
 * shared semantic errors.
 */
import { prisma, type Prisma, type PrismaClient } from '@jobs-app/database';
import { DatabaseError, NotFoundError } from '@jobs-app/shared';
import type {
  ApplicationEventInput,
  ApplicationEventRow,
  ApplicationListFilter,
  ApplicationListItem,
  ApplicationRow,
  ApplicationStatus,
  ApplicationStatusCount,
  ApplicationWithEvents,
  CreateApplicationInput,
} from './types.js';
import { emptyStatusCounts } from './transitions.js';

type Db = PrismaClient;

export interface PreparableMatchRow {
  jobId: string;
  title: string;
  company: string;
  url: string;
  sourceName: string | null;
}

const JOB_SUMMARY_INCLUDE = {
  job: {
    select: {
      id: true,
      title: true,
      company: true,
      remote: true,
      location: true,
      url: true,
    },
  },
} as const;

export class ApplicationRepository {
  constructor(private readonly db: Db = prisma) {}

  findById(id: string): Promise<ApplicationWithEvents | null> {
    return this.db.application.findUnique({
      where: { id },
      include: { events: { orderBy: { at: 'asc' } } },
    });
  }

  findBySubmissionKey(submissionKey: string): Promise<ApplicationRow | null> {
    return this.db.application.findUnique({ where: { submissionKey } });
  }

  findByJob(profileId: string, jobId: string): Promise<ApplicationRow | null> {
    return this.db.application.findUnique({ where: { profileId_jobId: { profileId, jobId } } });
  }

  async getApplication(id: string): Promise<ApplicationWithEvents> {
    const application = await this.findById(id);
    if (!application) throw new NotFoundError(`Application not found: ${id}`);
    return application;
  }

  /** Create one application. Callers must check `findByJob` first for idempotency. */
  async createApplication(input: CreateApplicationInput): Promise<ApplicationRow> {
    try {
      return await this.db.application.create({
        data: {
          profileId: input.profileId,
          jobId: input.jobId,
          url: sanitizeDisplayText(input.url),
          mode: input.mode ?? 'review',
          ...(input.sourceName ? { sourceName: sanitizeDisplayText(input.sourceName) } : {}),
          ...(input.submissionKey ? { submissionKey: input.submissionKey } : {}),
          events: { create: [{ type: 'application.preparing', stage: 'idle' }] },
        },
      });
    } catch (error) {
      throw new DatabaseError('Failed to create application', { cause: error });
    }
  }

  /** Id of the single local candidate profile, or null when none exists. */
  async findCandidateId(): Promise<string | null> {
    const profile = await this.db.candidateProfile.findFirst({ select: { id: true } });
    return profile?.id ?? null;
  }

  /**
   * Eligible, active matches ordered by score — the candidate pool the
   * preparation stage turns into Prepared applications. Includes the matched
   * job's details so callers can build the application without a second query.
   */
  listPreparableMatches(filter: {
    limit: number;
    offset: number;
  }): Promise<PreparableMatchRow[]> {
    return this.db.jobMatch
      .findMany({
        where: { eligible: true, job: { status: 'Active' } },
        orderBy: [{ totalScore: 'desc' }, { updatedAt: 'desc' }],
        skip: filter.offset,
        take: filter.limit,
        select: {
          jobId: true,
          job: {
            select: { title: true, company: true, url: true, sourceName: true, status: true },
          },
        },
      })
      .then((rows) =>
        rows.flatMap((row) => {
          const job = row.job;
          if (!job || job.status !== 'Active') return [];
          return [
            {
              jobId: row.jobId,
              title: job.title,
              company: job.company,
              url: job.url,
              sourceName: job.sourceName,
            },
          ];
        }),
      );
  }

  listApplications(filter: ApplicationListFilter = {}): Promise<ApplicationListItem[]> {
    return this.db.application.findMany({
      where: toWhere(filter),
      include: JOB_SUMMARY_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...(filter.limit !== undefined ? { take: filter.limit } : {}),
      ...(filter.offset !== undefined ? { skip: filter.offset } : {}),
    });
  }

  countApplications(filter: ApplicationListFilter = {}): Promise<number> {
    return this.db.application.count({ where: toWhere(filter) });
  }

  /** Per-status counts for dashboard summaries (zero-filled). */
  async countByStatus(
    filter: Pick<ApplicationListFilter, 'sourceName' | 'company'> = {},
  ): Promise<ApplicationStatusCount> {
    const groups = await this.db.application.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: toWhere(filter),
    });
    const counts = emptyStatusCounts();
    for (const group of groups) {
      const status = group.status as ApplicationStatus;
      const count = group._count._all;
      counts[status] = count;
    }
    return counts;
  }

  async updateStatus(
    applicationId: string,
    status: ApplicationStatus,
    now: Date = new Date(),
  ): Promise<ApplicationRow> {
    try {
      return await this.db.application.update({
        where: { id: applicationId },
        data: {
          status,
          ...(status === 'Submitted' ? { submittedAt: now } : {}),
          ...(status === 'Verified' ? { verifiedAt: now } : {}),
        },
      });
    } catch (error) {
      throw new DatabaseError('Failed to update application status', { cause: error });
    }
  }

  /** Attach the idempotency key (no-op when already equal). */
  async setSubmissionKey(
    applicationId: string,
    submissionKey: string,
  ): Promise<ApplicationRow> {
    try {
      return await this.db.application.update({
        where: { id: applicationId },
        data: { submissionKey },
      });
    } catch (error) {
      throw new DatabaseError('Failed to set submission key', { cause: error });
    }
  }

  async addEvent(
    applicationId: string,
    input: ApplicationEventInput,
  ): Promise<ApplicationEventRow> {
    try {
      return await this.db.applicationEvent.create({
        data: {
          applicationId,
          type: input.type,
          ...(input.stage ? { stage: input.stage } : {}),
          ...(input.payload ? { payload: input.payload as Prisma.InputJsonValue } : {}),
          ...(input.at ? { at: input.at } : {}),
        },
      });
    } catch (error) {
      throw new DatabaseError('Failed to record application event', { cause: error });
    }
  }

  /** Mirror a state change into the cross-cutting audit trail. */
  async audit(
    action: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.db.auditLog.create({
      data: {
        action,
        entityType: 'application',
        entityId,
        ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }
}

/**
 * Neutralize display text before persistence. URLs and source names originate
 * from external listings or user input; stripping control and HTML-significant
 * characters keeps stored rows inert as defense-in-depth — render layers must
 * still escape untrusted fields.
 */
function sanitizeDisplayText(value: string): string {
  return value
    .split('')
    .filter((char) => (char.codePointAt(0) ?? 0) >= 0x20)
    .join('')
    .replace(/[<>&"']/g, '')
    .trim();
}

function toWhere(filter: ApplicationListFilter): Prisma.ApplicationWhereInput {
  return {
    ...(filter.status !== undefined ? { status: filter.status } : {}),
    ...(filter.sourceName !== undefined ? { sourceName: filter.sourceName } : {}),
    ...(filter.company !== undefined
      ? { job: { company: { contains: filter.company, mode: 'insensitive' } } }
      : {}),
  };
}
