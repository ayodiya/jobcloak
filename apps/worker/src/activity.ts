import { randomUUID } from 'node:crypto';
import type { WorkerActivityEvent } from '@jobs-app/shared';
import type { QueueName } from './queues.js';

/**
 * Minimal shape of a BullMQ job the worker emits activity for. Structurally
 * satisfied by `Job`; kept narrow so the mapper stays unit-testable without
 * a live Redis/BullMQ.
 */
export interface ActivityJobLike {
  id?: string | null;
  name: string;
  processedOn?: number | null;
  finishedOn?: number | null;
  failedReason?: string | null;
  returnvalue?: unknown;
}

export function toActivityEvent(
  queue: QueueName,
  job: ActivityJobLike,
  outcome: 'completed' | 'failed',
  now: Date = new Date(),
): WorkerActivityEvent {
  const skipped = outcome === 'completed' && isSkipped(job.returnvalue);
  const finished = job.finishedOn ?? now.getTime();
  const started = job.processedOn;
  return {
    id: randomUUID(),
    queue,
    jobId: job.id ?? 'unknown',
    jobName: job.name,
    outcome: skipped ? 'skipped' : outcome,
    at: new Date(finished).toISOString(),
    durationMs: started != null ? Math.max(0, finished - started) : null,
    error: outcome === 'failed' ? (job.failedReason ?? 'failed') : null,
    detail: skipped ? 'daily limit reached; job skipped' : null,
  };
}

/** Limit-guarded processors return `{ skipped: true, ... }` when gated. */
function isSkipped(returnvalue: unknown): boolean {
  return (
    typeof returnvalue === 'object' &&
    returnvalue !== null &&
    (returnvalue as { skipped?: unknown }).skipped === true
  );
}
