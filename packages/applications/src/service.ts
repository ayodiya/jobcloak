/**
 * Application service: the single entry point apps use to read and advance the
 * application lifecycle. All input is validated and normalized; the repository
 * persists. Status changes are gated by the transition state machine and
 * mirrored into the application event trail and the cross-cutting audit log.
 */
import { AppError, ConflictError, NotFoundError, ValidationError } from '@jobs-app/shared';
import { ApplicationRepository } from './repository.js';
import { canTransition, statusEventType } from './transitions.js';
import type {
  ApplicationEventInput,
  ApplicationEventRow,
  ApplicationListFilter,
  ApplicationListItem,
  ApplicationMode,
  ApplicationPreparationResult,
  ApplicationRow,
  ApplicationStatus,
  ApplicationStatusCount,
  ApplicationWithEvents,
  CreateApplicationInput,
  PrepareApplicationsOptions,
} from './types.js';
import { isApplicationMode, isApplicationStatus } from './types.js';

export class ApplicationService {
  private readonly repository: ApplicationRepository;

  constructor(repository: ApplicationRepository = new ApplicationRepository()) {
    this.repository = repository;
  }

  get repo(): ApplicationRepository {
    return this.repository;
  }

  /** Idempotent create: an existing application for (profile, job) is returned. */
  async createApplication(input: CreateApplicationInput): Promise<ApplicationRow> {
    validateCreate(input);
    const existing = await this.repository.findByJob(input.profileId, input.jobId);
    if (existing) {
      if (input.submissionKey && existing.submissionKey !== input.submissionKey) {
        return this.repository.setSubmissionKey(existing.id, input.submissionKey);
      }
      return existing;
    }
    const created = await this.repository.createApplication(input);
    await this.repository.audit('application.created', created.id, {
      jobId: input.jobId,
      sourceName: input.sourceName ?? null,
    });
    return created;
  }

  getApplication(id: string): Promise<ApplicationWithEvents> {
    return this.repository.getApplication(id);
  }

  /**
   * The preparation stage of the pipeline: walk eligible, active, scored
   * matches in score order and create a Prepared application for each, up to
   * `options.limit` new rows. Jobs that already have an application for the
   * candidate are counted and skipped; matches without a job URL are reported
   * as failures. Best-effort per job, bounded memory.
   */
  async prepareMatchesForCandidate(
    options: PrepareApplicationsOptions,
  ): Promise<ApplicationPreparationResult> {
    const profileId = await this.repository.findCandidateId();
    if (!profileId) {
      throw new NotFoundError('CandidateProfile not found. Create a profile first.');
    }

    const preparedIds: string[] = [];
    let skippedExisting = 0;
    const failed: ApplicationPreparationResult['failed'] = [];
    const pageSize = Math.max(1, Math.min(options.limit, 100));
    let offset = 0;

    while (preparedIds.length < options.limit) {
      const rows = await this.repository.listPreparableMatches({ limit: pageSize, offset });
      if (rows.length === 0) break;
      offset += rows.length;

      for (const row of rows) {
        if (preparedIds.length >= options.limit) break;

        if (await this.repository.findByJob(profileId, row.jobId)) {
          skippedExisting += 1;
          continue;
        }
        if (!row.url) {
          failed.push({
            jobId: row.jobId,
            code: 'NO_URL',
            message: 'Listing has no application URL',
          });
          continue;
        }

        try {
          await this.createApplication({
            profileId,
            jobId: row.jobId,
            url: row.url,
            sourceName: row.sourceName ?? undefined,
            mode: 'review',
          });
          preparedIds.push(row.jobId);
        } catch (error) {
          failed.push({ jobId: row.jobId, ...toErrorSummary(error) });
        }
      }
    }

    return {
      prepared: preparedIds.length,
      createdJobIds: preparedIds,
      skippedExisting,
      failed,
    };
  }

  async listApplications(filter: ApplicationListFilter = {}): Promise<{
    rows: ApplicationListItem[];
    total: number;
  }> {
    const [rows, total] = await Promise.all([
      this.repository.listApplications(filter),
      this.repository.countApplications(filter),
    ]);
    return { rows, total };
  }

  countByStatus(
    filter: Pick<ApplicationListFilter, 'sourceName' | 'company'> = {},
  ): Promise<ApplicationStatusCount> {
    return this.repository.countByStatus(filter);
  }

  /** Append an arbitrary event (browser replay, manual corrections). */
  async recordEvent(
    applicationId: string,
    input: ApplicationEventInput,
  ): Promise<ApplicationEventRow> {
    await this.repository.getApplication(applicationId);
    return this.repository.addEvent(applicationId, {
      ...input,
      at: input.at ?? new Date(),
      payload: input.payload ?? null,
    });
  }

  /** Advance the application through the legal status machine. */
  async transition(
    applicationId: string,
    to: ApplicationStatus,
  ): Promise<ApplicationWithEvents> {
    if (!isApplicationStatus(to)) {
      throw new ValidationError(`Unknown application status: ${String(to)}`);
    }
    const application = await this.repository.getApplication(applicationId);
    const from = application.status as ApplicationStatus;
    if (to === from) return application;
    if (!canTransition(from, to)) {
      throw new ConflictError(`Cannot transition application from ${from} to ${to}`);
    }
    await this.repository.updateStatus(applicationId, to);
    await this.repository.addEvent(applicationId, {
      type: statusEventType(to),
      stage: null,
      payload: { from },
    });
    await this.repository.audit(`application.${statusEventType(to)}`, applicationId, {
      from,
      jobId: application.jobId,
    });
    return this.repository.getApplication(applicationId);
  }
}

function validateCreate(input: CreateApplicationInput): void {
  if (!input.jobId || !input.profileId) {
    throw new ValidationError('jobId and profileId are required');
  }
  if (!input.url || input.url.trim() === '') {
    throw new ValidationError('url is required');
  }
  if (input.mode !== undefined && !isApplicationMode(input.mode)) {
    throw new ValidationError(`Unknown automation mode: ${String(input.mode)}`);
  }
  if (
    input.submissionKey !== undefined &&
    input.submissionKey !== null &&
    input.submissionKey === ''
  ) {
    throw new ValidationError('submissionKey must be non-empty when provided');
  }
}

/** Semantic, safely-displayable error summary for preparation results. */
function toErrorSummary(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) return { code: error.code, message: error.message };
  return { code: 'INTERNAL', message: 'Unexpected error' };
}

export type {
  ApplicationMode,
  ApplicationStatus,
  ApplicationStatusCount,
  ApplicationWithEvents,
  ApplicationListItem,
};
