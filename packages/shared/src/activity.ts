/**
 * Realtime worker-activity contract shared between the worker (publisher)
 * and the API (subscriber/SSE fan-out). The worker emits one event per
 * background job it completes, skips or fails; the API replays recent
 * history to new subscribers and pushes new events live.
 */
export const ACTIVITY_CHANNEL = 'worker:activity';

export type WorkerActivityOutcome = 'completed' | 'skipped' | 'failed';

export interface WorkerActivityEvent {
  /** Unique event id. */
  id: string;
  /** BullMQ queue the job ran on (e.g. jobDiscovery, aiMatching). */
  queue: string;
  /** BullMQ job id. */
  jobId: string;
  /** BullMQ job name (e.g. scheduled-discovery). */
  jobName: string;
  outcome: WorkerActivityOutcome;
  /** ISO timestamp when the job finished. */
  at: string;
  /** Processing duration in milliseconds; null when unknown. */
  durationMs: number | null;
  /** Failure message; null unless outcome === 'failed'. */
  error: string | null;
  /** Machine-readable note, e.g. the reason a job was skipped. */
  detail: string | null;
}
