/**
 * Legal status transitions and helpers for the application lifecycle.
 * Pure module (no dependencies) so the state machine is unit-tested without a
 * database.
 */
import type { ApplicationStatus, ApplicationStatusCount } from './types.js';

/** Applications that are not yet submitted or terminal — "in flight". */
export const ACTIVE_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['Prepared', 'InProgress']);

/** Terminal states: no further transitions. */
export const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['Verified', 'Rejected']);

/**
 * Allowed transitions. Retrying a failed/cancelled run returns it to
 * Prepared/InProgress; success paths end at Verified, and a human may later
 * mark a Verified application as Rejected. No path leaves Rejected.
 */
const TRANSITIONS: Record<ApplicationStatus, ReadonlyArray<ApplicationStatus>> = {
  Prepared: ['InProgress', 'Failed', 'Cancelled'],
  InProgress: ['Submitted', 'Failed', 'Cancelled'],
  Submitted: ['Verified', 'Failed'],
  Verified: ['Rejected'],
  Failed: ['Prepared', 'InProgress'],
  Cancelled: ['Prepared', 'InProgress'],
  Rejected: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Stable machine-readable event type for a status transition. */
export function statusEventType(status: ApplicationStatus): string {
  switch (status) {
    case 'InProgress':
      return 'application.in_progress';
    case 'Prepared':
      return 'application.preparing';
    default:
      return `application.${status.toLowerCase()}`;
  }
}

/** Zero-filled per-status counts — the baseline for dashboard summaries. */
export function emptyStatusCounts(): ApplicationStatusCount {
  return {
    Prepared: 0,
    InProgress: 0,
    Submitted: 0,
    Verified: 0,
    Failed: 0,
    Cancelled: 0,
    Rejected: 0,
  };
}