/**
 * Application service: the single entry point apps use to read and advance the
 * application lifecycle. All input is validated and normalized; the repository
 * persists. Status changes are gated by the transition state machine and
 * mirrored into the application event trail and the cross-cutting audit log.
 */
import { ConflictError, ValidationError } from '@jobs-app/shared';
import { ApplicationRepository } from './repository.js';
import { canTransition, statusEventType } from './transitions.js';
import type {
  ApplicationEventInput,
  ApplicationEventRow,
  ApplicationListFilter,
  ApplicationListItem,
  ApplicationMode,
  ApplicationRow,
  ApplicationStatus,
  ApplicationStatusCount,
  ApplicationWithEvents,
  CreateApplicationInput,
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

  countByStatus(filter: Pick<ApplicationListFilter, 'sourceName' | 'company'> = {}): Promise<ApplicationStatusCount> {
    return this.repository.countByStatus(filter);
  }

  /** Append an arbitrary event (browser replay, manual corrections). */
  async recordEvent(applicationId: string, input: ApplicationEventInput): Promise<ApplicationEventRow> {
    await this.repository.getApplication(applicationId);
    return this.repository.addEvent(applicationId, {
      ...input,
      at: input.at ?? new Date(),
      payload: input.payload ?? null,
    });
  }

  /** Advance the application through the legal status machine. */
  async transition(applicationId: string, to: ApplicationStatus): Promise<ApplicationWithEvents> {
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
  if (input.submissionKey !== undefined && input.submissionKey !== null && input.submissionKey === '') {
    throw new ValidationError('submissionKey must be non-empty when provided');
  }
}

export type { ApplicationMode, ApplicationStatus, ApplicationStatusCount, ApplicationWithEvents, ApplicationListItem };