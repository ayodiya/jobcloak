import type { Queue } from 'bullmq';
import type { QueueName } from './queues.js';

export interface SchedulerDefinition {
  id: string;
  queue: QueueName;
  /** BullMQ repeat options: fixed interval (`every`, ms) or cron (`pattern`). */
  repeat: { pattern?: string; every?: number };
  template: { name: string; data: Record<string, unknown> };
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Phase 9 repeatables: discovery and matching on fixed intervals, the daily
 * report on a cron. Idempotent by design — `upsertJobScheduler` upserts on
 * every boot (BullMQ `override: true` semantics), so no cleanup pass runs at
 * shutdown and schedulers survive restarts.
 */
export const SCHEDULERS: readonly SchedulerDefinition[] = [
  {
    id: 'discovery-every-6h',
    queue: 'jobDiscovery',
    repeat: { every: 6 * HOUR_MS },
    template: { name: 'scheduled-discovery', data: { source: 'scheduler' } },
  },
  {
    id: 'matching-every-6h',
    queue: 'aiMatching',
    repeat: { every: 6 * HOUR_MS },
    template: { name: 'scheduled-matching', data: { source: 'scheduler' } },
  },
  {
    id: 'preparation-every-6h',
    queue: 'applicationPreparation',
    repeat: { every: 6 * HOUR_MS },
    template: { name: 'scheduled-preparation', data: { source: 'scheduler' } },
  },
  {
    id: 'daily-report-18-utc',
    queue: 'notifications',
    repeat: { pattern: '0 18 * * *' },
    template: { name: 'daily-report', data: { source: 'scheduler' } },
  },
] as const;

/**
 * Upsert every scheduler into its target queue. Queues are injected so tests
 * pass plain fakes — no Redis connection or bullmq module mock required.
 */
export async function upsertSchedulers(
  queues: ReadonlyMap<QueueName, Queue>,
  defs: readonly SchedulerDefinition[] = SCHEDULERS,
): Promise<string[]> {
  const applied: string[] = [];
  for (const def of defs) {
    const queue = queues.get(def.queue);
    if (!queue) {
      throw new Error(`No queue wired for scheduler "${def.id}" (queue "${def.queue}")`);
    }
    await queue.upsertJobScheduler(def.id, def.repeat, {
      name: def.template.name,
      data: def.template.data,
    });
    applied.push(def.id);
  }
  return applied;
}
