import type { Processor, Queue } from 'bullmq';
import type { Env } from '@jobs-app/config';
import type { DiscoverySummary } from '@jobs-app/jobs';
import {
  buildDailyReport,
  dailyReportToMessage,
  type DailyReport,
  type DailyReportInput,
  type LimitStat,
  type NotificationMessage,
  type NotificationRegistry,
  type QueueStat,
} from '@jobs-app/notifications';
import type { Logger } from '@jobs-app/shared';
import { withCorrelation } from '@jobs-app/shared';
import {
  LIMIT_KINDS,
  consumeLimit,
  peekLimit,
  utcDate,
  type LimitKind,
  type LimitStore,
} from './limits.js';
import { QUEUE_NAMES, type QueueName } from './queues.js';

export interface ProcessorDeps {
  config: Env;
  logger: Logger;
  registry: NotificationRegistry;
  store: LimitStore;
  /** Queue name → live Queue; the daily report reads `getJobCounts` from these. */
  queues: ReadonlyMap<QueueName, Queue>;
  /**
   * Discovery callback used by the `jobDiscovery` processor. Injected by the
   * worker entrypoint and backed by `JobService.discover`, which already
   * records source health (and never throws) internally.
   */
  discover?: (sourceName: string) => Promise<DiscoverySummary>;
}

/**
 * Daily-limit gate. Jobs past the cap complete successfully (a repeatable
 * that throws would retry forever and pile up failures) — they are skipped
 * with a warning notification instead. Optional `inner` domain work runs
 * only when the gate passes.
 */
export function createLimitGuardedProcessor(
  kind: LimitKind,
  deps: ProcessorDeps,
  inner?: Processor<unknown>,
): Processor<unknown> {
  return async (job) =>
    withCorrelation(async () => {
      const decision = await consumeLimit(deps.store, deps.config, kind);
      if (!decision.allowed) {
        deps.logger.warn(
          { kind, jobId: job.id, used: decision.used, limit: decision.limit },
          'daily limit reached; completing job without side effects',
        );
        await deps.registry.send({
          title: `Daily limit reached: ${kind}`,
          body: `${decision.used}/${decision.limit} ${kind} jobs used today (${decision.date}).`,
          severity: 'warning',
          at: new Date().toISOString(),
          fields: {
            kind: decision.kind,
            used: decision.used,
            limit: decision.limit,
            date: decision.date,
          },
        });
        return { skipped: true, kind, used: decision.used, remaining: decision.remaining };
      }
      deps.logger.info(
        { kind, jobId: job.id, used: decision.used, remaining: decision.remaining },
        'daily limit gate passed',
      );
      const work = inner ? await inner(job) : undefined;
      return { skipped: false, kind, used: decision.used, remaining: decision.remaining, work };
    });
}

export interface DiscoveryRunResult {
  source: string;
  healthy: boolean;
  fetched?: number;
  created?: number;
  updated?: number;
  rejected?: number;
  requirementCount?: number;
  error?: string;
}

function configuredSources(deps: ProcessorDeps, data: unknown): string[] {
  if (typeof data === 'object' && data !== null) {
    const raw = (data as Record<string, unknown>).sources;
    const list = Array.isArray(raw)
      ? raw.filter((v): v is string => typeof v === 'string')
      : [];
    if (list.length > 0) return list;
  }
  return deps.config.JOB_DISCOVERY_SOURCES.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Scheduled job-board discovery: crawl every configured source once per run,
 * persisting new listings and refreshing existing ones via the DB-backed
 * JobService. A failed source is recorded (health) per-source and reported,
 * never thrown — a resilient board must not kill the whole run.
 */
export function createJobDiscoveryProcessor(deps: ProcessorDeps): Processor<unknown> {
  return createLimitGuardedProcessor('jobDiscovery', deps, async (job) => {
    if (!deps.discover) {
      deps.logger.warn(
        { jobId: job.id, name: job.name },
        'discovery requested but no JobService is wired; acknowledging',
      );
      return { wired: false };
    }
    const sources = configuredSources(deps, job.data);
    deps.logger.info({ jobId: job.id, sources }, 'starting discovery run');
    const results: DiscoveryRunResult[] = [];
    for (const source of sources) {
      try {
        const summary = await deps.discover(source);
        results.push({ source, ...summary });
        deps.logger.info(
          {
            source,
            fetched: summary.fetched,
            created: summary.created,
            updated: summary.updated,
            rejected: summary.rejected,
          },
          'source discovered',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ source, healthy: false, error: message });
        deps.logger.error({ source, error: message }, 'source discovery crashed');
      }
    }
    const discovered = results.filter((r) => r.healthy).length;
    const failed = results.length - discovered;
    const created = results.reduce((n, r) => n + (r.created ?? 0), 0);
    const updated = results.reduce((n, r) => n + (r.updated ?? 0), 0);
    return { requested: sources.length, discovered, failed, created, updated, results };
  });
}

function toNotificationMessage(data: unknown, fallbackAt: string): NotificationMessage {
  const raw: Record<string, unknown> =
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const severity =
    raw.severity === 'warning' || raw.severity === 'error' ? raw.severity : 'info';
  const fields =
    typeof raw.fields === 'object' && raw.fields !== null
      ? (raw.fields as Record<string, unknown>)
      : undefined;
  return {
    title: typeof raw.title === 'string' ? raw.title : 'Notification',
    body: typeof raw.body === 'string' ? raw.body : '',
    severity,
    at: typeof raw.at === 'string' ? raw.at : fallbackAt,
    ...(fields ? { fields } : {}),
  };
}

async function buildAndSendDailyReport(deps: ProcessorDeps): Promise<DailyReport> {
  const queueStats: QueueStat[] = [];
  for (const name of QUEUE_NAMES) {
    const queue = deps.queues.get(name);
    if (!queue) continue;
    const counts = await queue.getJobCounts('completed', 'failed', 'waiting', 'active');
    queueStats.push({
      queue: name,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
    });
  }
  const limits: LimitStat[] = [];
  for (const kind of LIMIT_KINDS) {
    limits.push(await peekLimit(deps.store, deps.config, kind));
  }
  const input: DailyReportInput = {
    date: utcDate(),
    generatedAt: new Date().toISOString(),
    queues: queueStats,
    limits,
  };
  const report = buildDailyReport(input);
  const results = await deps.registry.send(dailyReportToMessage(report));
  deps.logger.info(
    { date: report.date, severity: report.severity, results },
    'daily report generated',
  );
  return report;
}

/**
 * Handler for the `notifications` queue: the scheduled `daily-report` job
 * aggregates queue counts and limit usage into a report; any other job is an
 * ad-hoc notification whose payload is normalized and fanned out.
 */
export function createNotificationsProcessor(deps: ProcessorDeps): Processor<unknown> {
  return async (job) =>
    withCorrelation(async () => {
      if (job.name === 'daily-report') {
        return buildAndSendDailyReport(deps);
      }
      const message = toNotificationMessage(job.data, new Date().toISOString());
      const results = await deps.registry.send(message);
      deps.logger.info({ jobId: job.id, name: job.name, results }, 'notification delivered');
      return results;
    });
}

/** Placeholder handler for queues whose domain work is not wired into the worker yet. */
export function createLogOnlyProcessor(label: string, deps: ProcessorDeps): Processor<unknown> {
  return async (job) =>
    withCorrelation(async () => {
      deps.logger.info(
        { label, jobId: job.id, name: job.name },
        'job acknowledged (no domain handler attached)',
      );
      return { acknowledged: true };
    });
}
