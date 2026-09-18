/**
 * Persistence for job discovery: jobs, their requirements and source health.
 * Prisma errors are translated into shared semantic errors.
 */
import { Prisma, prisma, type PrismaClient } from '@jobs-app/database';
import { DatabaseError, NotFoundError } from '@jobs-app/shared';
import type { JobListFilter, JobRequirementInput, NormalizedJob, SourceHealthResult } from './types.js';

type Db = PrismaClient;
type JobRow = Prisma.JobGetPayload<Record<string, never>>;
type RequirementRow = Prisma.JobRequirementGetPayload<Record<string, never>>;
type SourceHealthRow = Prisma.SourceHealthGetPayload<Record<string, never>>;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class JobRepository {
  constructor(private readonly db: Db = prisma) {}

  findById(id: string): Promise<JobRow | null> {
    return this.db.job.findUnique({ where: { id } });
  }

  findByFingerprint(sourceName: string, fingerprint: string): Promise<JobRow | null> {
    return this.db.job.findUnique({
      where: { sourceName_fingerprint: { sourceName, fingerprint } },
    });
  }

  /**
   * Insert or refresh a job keyed by (sourceName, fingerprint). Re-discovering
   * an existing listing updates it and bumps `lastSeenAt`; it never duplicates.
   */
  async upsertJob(
    job: NormalizedJob,
    now: Date = new Date(),
  ): Promise<{ job: JobRow; created: boolean }> {
    const data = toJobData(job);
    const existing = await this.findByFingerprint(job.sourceName, job.fingerprint);
    if (existing) {
      try {
        const updated = await this.db.job.update({
          where: { id: existing.id },
          data: { ...data, lastSeenAt: now },
        });
        return { job: updated, created: false };
      } catch (error) {
        throw new DatabaseError('Failed to update job', { cause: error });
      }
    }

    try {
      const created = await this.db.job.create({ data: { ...data, discoveredAt: now, lastSeenAt: now } });
      return { job: created, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.findByFingerprint(job.sourceName, job.fingerprint);
        if (raced) return { job: raced, created: false };
      }
      throw new DatabaseError('Failed to create job', { cause: error });
    }
  }

  listJobs(filter: JobListFilter = {}): Promise<JobRow[]> {
    return this.db.job.findMany({
      where: toWhere(filter),
      orderBy: [{ discoveredAt: 'desc' }, { id: 'asc' }],
      ...(filter.limit !== undefined ? { take: filter.limit } : {}),
      ...(filter.offset !== undefined ? { skip: filter.offset } : {}),
    });
  }

  countJobs(filter: JobListFilter = {}): Promise<number> {
    return this.db.job.count({ where: toWhere(filter) });
  }

  getRequirements(jobId: string): Promise<RequirementRow[]> {
    return this.db.jobRequirement.findMany({
      where: { jobId },
      orderBy: [{ kind: 'asc' }, { category: 'asc' }, { key: 'asc' }],
    });
  }

  /** Replace a job's requirements atomically (deterministic rebuild). */
  async replaceRequirements(jobId: string, requirements: JobRequirementInput[]): Promise<number> {
    try {
      await this.db.$transaction([
        this.db.jobRequirement.deleteMany({ where: { jobId } }),
        this.db.jobRequirement.createMany({
          data: requirements.map((requirement) => ({
            jobId,
            kind: requirement.kind,
            category: requirement.category,
            key: requirement.key,
            name: requirement.name,
            source: requirement.source,
            ...(requirement.level !== undefined ? { level: requirement.level } : {}),
            ...(requirement.minYears !== undefined ? { minYears: requirement.minYears } : {}),
            ...(requirement.detail !== undefined ? { detail: requirement.detail } : {}),
            ...(requirement.confidence !== undefined ? { confidence: requirement.confidence } : {}),
          })),
          skipDuplicates: true,
        }),
      ]);
      return requirements.length;
    } catch (error) {
      throw new DatabaseError('Failed to replace job requirements', { cause: error });
    }
  }

  async getJobById(id: string): Promise<JobRow> {
    const job = await this.findById(id);
    if (!job) throw new NotFoundError(`Job not found: ${id}`);
    return job;
  }

  /** Record the outcome of a source run; failure streaks are tracked. */
  async recordSourceHealth(result: SourceHealthResult, now: Date = new Date()): Promise<SourceHealthRow> {
    const existing = await this.db.sourceHealth.findUnique({ where: { sourceName: result.sourceName } });
    const consecutiveFailures = result.healthy ? 0 : (existing?.consecutiveFailures ?? 0) + 1;

    try {
      return await this.db.sourceHealth.upsert({
        where: { sourceName: result.sourceName },
        create: {
          sourceName: result.sourceName,
          healthy: result.healthy,
          consecutiveFailures,
          lastError: result.error ?? null,
          lastCheckedAt: now,
          lastSuccessAt: result.healthy ? now : null,
        },
        update: {
          healthy: result.healthy,
          consecutiveFailures,
          lastError: result.error ?? null,
          lastCheckedAt: now,
          ...(result.healthy ? { lastSuccessAt: now } : {}),
        },
      });
    } catch (error) {
      throw new DatabaseError('Failed to record source health', { cause: error });
    }
  }

  listSourceHealth(): Promise<SourceHealthRow[]> {
    return this.db.sourceHealth.findMany({ orderBy: { sourceName: 'asc' } });
  }
}

function toJobData(job: NormalizedJob): Omit<Prisma.JobUncheckedCreateInput, 'discoveredAt' | 'lastSeenAt'> {
  return {
    sourceName: job.sourceName,
    fingerprint: job.fingerprint,
    url: job.url,
    normalizedUrl: job.normalizedUrl,
    title: job.title,
    company: job.company,
    description: job.description,
    remote: job.remote,
    ...(job.location !== undefined ? { location: job.location } : {}),
    ...(job.employmentType !== undefined ? { employmentType: job.employmentType } : {}),
    ...(job.seniority !== undefined ? { seniority: job.seniority } : {}),
    ...(job.salaryMin !== undefined ? { salaryMin: job.salaryMin } : {}),
    ...(job.salaryMax !== undefined ? { salaryMax: job.salaryMax } : {}),
    ...(job.salaryCurrency !== undefined ? { salaryCurrency: job.salaryCurrency } : {}),
    ...(job.postedAt !== undefined ? { postedAt: job.postedAt } : {}),
    ...(job.raw !== undefined ? { raw: job.raw as Prisma.InputJsonValue } : {}),
  };
}

function toWhere(filter: JobListFilter): Prisma.JobWhereInput {
  return {
    ...(filter.sourceName !== undefined ? { sourceName: filter.sourceName } : {}),
    ...(filter.remote !== undefined ? { remote: filter.remote } : {}),
    ...(filter.company !== undefined ? { company: { contains: filter.company, mode: 'insensitive' } } : {}),
    ...(filter.status !== undefined ? { status: filter.status } : {}),
  };
}

export type { JobRow, RequirementRow, SourceHealthRow };
