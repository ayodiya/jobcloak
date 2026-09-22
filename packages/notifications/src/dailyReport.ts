import type { NotificationMessage } from './channel.js';

export interface QueueStat {
  queue: string;
  completed: number;
  failed: number;
  waiting: number;
  active: number;
}

export interface LimitStat {
  kind: string;
  used: number;
  limit: number;
}

export interface DailyReportInput {
  /** YYYY-MM-DD (UTC day the report covers). */
  date: string;
  /** ISO timestamp when the report was generated. */
  generatedAt: string;
  queues: QueueStat[];
  limits: LimitStat[];
}

export type ReportSeverity = NotificationMessage['severity'];

export interface DailyReport extends DailyReportInput {
  totals: { completed: number; failed: number; waiting: number; active: number };
  /** Limit kinds that are fully consumed (used >= limit). */
  exhausted: string[];
  severity: ReportSeverity;
}

/**
 * Pure report builder so tests never need Redis or BullMQ. Severity rule:
 * an exhausted daily limit is an error, job failures are a warning, clean run
 * is info.
 */
export function buildDailyReport(input: DailyReportInput): DailyReport {
  const totals = { completed: 0, failed: 0, waiting: 0, active: 0 };
  for (const queue of input.queues) {
    totals.completed += queue.completed;
    totals.failed += queue.failed;
    totals.waiting += queue.waiting;
    totals.active += queue.active;
  }
  const exhausted = input.limits.filter((l) => l.used >= l.limit).map((l) => l.kind);
  const severity: ReportSeverity =
    exhausted.length > 0 ? 'error' : totals.failed > 0 ? 'warning' : 'info';
  return { ...input, totals, exhausted, severity };
}

export function renderDailyReportMarkdown(report: DailyReport): string {
  const queueLines = report.queues.map(
    (q) => `- ${q.queue}: ${q.completed} completed, ${q.failed} failed, ${q.waiting} waiting, ${q.active} active`,
  );
  const limitLines = report.limits.map(
    (l) => `- ${l.kind}: ${l.used}/${l.limit}${report.exhausted.includes(l.kind) ? ' (exhausted)' : ''}`,
  );
  return [
    `# Daily report — ${report.date}`,
    '',
    '## Queues',
    ...queueLines,
    '',
    '## Daily limits',
    ...limitLines,
    '',
    `Severity: ${report.severity}`,
  ].join('\n');
}

export function dailyReportToMessage(report: DailyReport): NotificationMessage {
  return {
    title: `Daily report — ${report.date}`,
    body: renderDailyReportMarkdown(report),
    severity: report.severity,
    at: report.generatedAt,
    fields: {
      totals: report.totals,
      exhausted: report.exhausted,
      queueCount: report.queues.length,
    },
  };
}
