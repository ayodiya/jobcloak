import { describe, expect, it } from 'vitest';
import type { DailyReportInput } from './dailyReport.js';
import {
  buildDailyReport,
  dailyReportToMessage,
  renderDailyReportMarkdown,
} from './dailyReport.js';

const base: DailyReportInput = {
  date: '2026-09-11',
  generatedAt: '2026-09-11T18:00:00.000Z',
  queues: [
    { queue: 'jobDiscovery', completed: 3, failed: 0, waiting: 1, active: 0 },
    { queue: 'notifications', completed: 1, failed: 2, waiting: 0, active: 0 },
  ],
  limits: [
    { kind: 'jobDiscovery', used: 3, limit: 50 },
    { kind: 'application', used: 10, limit: 10 },
  ],
};

describe('buildDailyReport', () => {
  it('totals queue stats, marks exhausted limits, and reports error severity', () => {
    const report = buildDailyReport(base);
    expect(report.totals).toEqual({ completed: 4, failed: 2, waiting: 1, active: 0 });
    expect(report.exhausted).toEqual(['application']);
    expect(report.severity).toBe('error');
  });

  it('warns when nothing is exhausted but failures exist', () => {
    const report = buildDailyReport({
      ...base,
      limits: [{ kind: 'jobDiscovery', used: 0, limit: 50 }],
    });
    expect(report.exhausted).toEqual([]);
    expect(report.severity).toBe('warning');
  });

  it('stays info on a clean run', () => {
    const report = buildDailyReport({
      ...base,
      queues: [{ queue: 'jobDiscovery', completed: 5, failed: 0, waiting: 0, active: 0 }],
      limits: [{ kind: 'jobDiscovery', used: 1, limit: 50 }],
    });
    expect(report.totals.failed).toBe(0);
    expect(report.severity).toBe('info');
  });
});

describe('renderDailyReportMarkdown', () => {
  it('includes date, per-queue lines, and the exhausted marker', () => {
    const markdown = renderDailyReportMarkdown(buildDailyReport(base));
    expect(markdown).toContain('# Daily report — 2026-09-11');
    expect(markdown).toContain('- jobDiscovery: 3 completed, 0 failed, 1 waiting, 0 active');
    expect(markdown).toContain('- notifications: 1 completed, 2 failed, 0 waiting, 0 active');
    expect(markdown).toContain('- application: 10/10 (exhausted)');
    expect(markdown).toContain('- jobDiscovery: 3/50');
  });
});

describe('dailyReportToMessage', () => {
  it('maps the report into a NotificationMessage', () => {
    const report = buildDailyReport(base);
    const message = dailyReportToMessage(report);
    expect(message.title).toBe('Daily report — 2026-09-11');
    expect(message.severity).toBe('error');
    expect(message.at).toBe(report.generatedAt);
    expect(message.body).toContain('## Daily limits');
    expect(message.fields?.exhausted).toEqual(['application']);
    expect(message.fields?.totals).toEqual(report.totals);
  });
});
