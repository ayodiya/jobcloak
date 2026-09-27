import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { SCHEDULERS, upsertSchedulers } from '../src/scheduler.js';
import type { QueueName } from '../src/queues.js';

function fakeQueue(name: string) {
  return {
    name,
    upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SCHEDULERS', () => {
  it('declares discovery, matching, preparation, and daily report schedulers with unique ids', () => {
    const ids = SCHEDULERS.map((s) => s.id);
    expect(ids).toEqual([
      'discovery-every-6h',
      'matching-every-6h',
      'preparation-every-6h',
      'daily-report-18-utc',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses interval repeats for discovery/matching/preparation and a cron pattern for the report', () => {
    const discovery = SCHEDULERS.find((s) => s.id === 'discovery-every-6h')!;
    expect(discovery.queue).toBe('jobDiscovery');
    expect(discovery.repeat.every).toBe(6 * 60 * 60 * 1000);
    expect(discovery.repeat.pattern).toBeUndefined();
    expect(discovery.template).toEqual({
      name: 'scheduled-discovery',
      data: { source: 'scheduler' },
    });

    const matching = SCHEDULERS.find((s) => s.id === 'matching-every-6h')!;
    expect(matching.queue).toBe('aiMatching');
    expect(matching.repeat.every).toBe(6 * 60 * 60 * 1000);

    const preparation = SCHEDULERS.find((s) => s.id === 'preparation-every-6h')!;
    expect(preparation.queue).toBe('applicationPreparation');
    expect(preparation.repeat.every).toBe(6 * 60 * 60 * 1000);
    expect(preparation.template).toEqual({
      name: 'scheduled-preparation',
      data: { source: 'scheduler' },
    });

    const report = SCHEDULERS.find((s) => s.id === 'daily-report-18-utc')!;
    expect(report.queue).toBe('notifications');
    expect(report.repeat.pattern).toBe('0 18 * * *');
    expect(report.repeat.every).toBeUndefined();
    expect(report.template.name).toBe('daily-report');
  });
});

describe('upsertSchedulers', () => {
  it('applies every scheduler to its target queue', async () => {
    const discovery = fakeQueue('jobDiscovery');
    const matching = fakeQueue('aiMatching');
    const preparation = fakeQueue('applicationPreparation');
    const notifications = fakeQueue('notifications');
    const queues = new Map<QueueName, Queue>([
      ['jobDiscovery', discovery as unknown as Queue],
      ['aiMatching', matching as unknown as Queue],
      ['applicationPreparation', preparation as unknown as Queue],
      ['notifications', notifications as unknown as Queue],
    ]);

    const applied = await upsertSchedulers(queues);

    expect(applied).toEqual([
      'discovery-every-6h',
      'matching-every-6h',
      'preparation-every-6h',
      'daily-report-18-utc',
    ]);
    expect(discovery.upsertJobScheduler).toHaveBeenCalledWith(
      'discovery-every-6h',
      { every: 6 * 60 * 60 * 1000 },
      { name: 'scheduled-discovery', data: { source: 'scheduler' } },
    );
    expect(matching.upsertJobScheduler).toHaveBeenCalledWith(
      'matching-every-6h',
      { every: 6 * 60 * 60 * 1000 },
      { name: 'scheduled-matching', data: { source: 'scheduler' } },
    );
    expect(preparation.upsertJobScheduler).toHaveBeenCalledWith(
      'preparation-every-6h',
      { every: 6 * 60 * 60 * 1000 },
      { name: 'scheduled-preparation', data: { source: 'scheduler' } },
    );
    expect(notifications.upsertJobScheduler).toHaveBeenCalledWith(
      'daily-report-18-utc',
      { pattern: '0 18 * * *' },
      { name: 'daily-report', data: { source: 'scheduler' } },
    );
  });

  it('throws when a target queue is not wired', async () => {
    const queues = new Map<QueueName, Queue>();
    await expect(upsertSchedulers(queues)).rejects.toThrow(/no queue wired/i);
  });
});
