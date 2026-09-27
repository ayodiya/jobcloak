/**
 * Application lifecycle domain types (Phase 8).
 *
 * One application targets one job for the single local candidate. The status
 * model follows docs/architecture/automation.md: Prepared → InProgress →
 * Submitted → Verified, with Failed/Cancelled for blocked runs and Rejected as
 * a later manual outcome. The immutable ApplicationEvent trail reuses the
 * browser SessionEventType vocabulary for session events and adds domain
 * transitions ("application.*").
 */
import type { Prisma } from '@jobs-app/database';

export type ApplicationStatus =
  'Prepared' | 'InProgress' | 'Submitted' | 'Verified' | 'Failed' | 'Cancelled' | 'Rejected';

/** Automation mode recorded on the application at submission time. */
export type ApplicationMode = 'safe' | 'review' | 'auto_apply';

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'Prepared',
  'InProgress',
  'Submitted',
  'Verified',
  'Failed',
  'Cancelled',
  'Rejected',
] as const;

export const APPLICATION_MODES: readonly ApplicationMode[] = [
  'safe',
  'review',
  'auto_apply',
] as const;

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return (
    typeof value === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isApplicationMode(value: unknown): value is ApplicationMode {
  return typeof value === 'string' && (APPLICATION_MODES as readonly string[]).includes(value);
}

export interface CreateApplicationInput {
  jobId: string;
  profileId: string;
  mode?: ApplicationMode;
  sourceName?: string;
  url: string;
  /** Idempotency key (automation.md): one submission per application + job. */
  submissionKey?: string | null;
}

export interface ApplicationListFilter {
  status?: ApplicationStatus;
  sourceName?: string;
  company?: string;
  limit?: number;
  offset?: number;
}

export interface ApplicationEventInput {
  type: string;
  stage?: string | null;
  payload?: Record<string, unknown> | null;
  at?: Date;
}

export interface PrepareApplicationsOptions {
  /** Maximum number of new Prepared applications to create in one run. */
  limit: number;
}

export interface PreparationFailure {
  jobId: string;
  code: string;
  message: string;
}

export interface ApplicationPreparationResult {
  prepared: number;
  createdJobIds: string[];
  skippedExisting: number;
  failed: PreparationFailure[];
}

export type ApplicationRow = Prisma.ApplicationGetPayload<Record<string, never>>;
export type ApplicationEventRow = Prisma.ApplicationEventGetPayload<Record<string, never>>;
export type ApplicationListItem = Prisma.ApplicationGetPayload<{
  include: {
    job: {
      select: {
        id: true;
        title: true;
        company: true;
        remote: true;
        location: true;
        url: true;
      };
    };
  };
}>;
export type ApplicationWithEvents = Prisma.ApplicationGetPayload<{
  include: { events: { orderBy: { at: 'asc' } } };
}>;
export type ApplicationStatusCount = Record<ApplicationStatus, number>;
