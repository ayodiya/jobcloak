import { parseEnv } from '@jobs-app/config';
import type { DiscoverySummary } from '@jobs-app/jobs';
import {
  createNotificationRegistry,
  type NotificationChannel,
  type NotificationMessage,
} from '@jobs-app/notifications';
import type { Job, Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { limitKey, utcDate, type LimitStore } from '../src/limits.js';
import {
  createJobDiscoveryProcessor,
  createLimitGuardedProcessor,
  createLogOnlyProcessor,
  createNotificationsProcessor,
  type ProcessorDeps,
} from '../src/processors.js';
import type { QueueName } from '../src/queues.js';

const config = parseEnv({
  JOB_DISCOVERY_DAILY_LIMIT: '1',
  APPLICATION_PREPARATION_DAILY_LIMIT: '1',
  APPLICATION_DAILY_LIMIT: '1',
  JOB_DISCOVERY_SOURCES: 'remoteok,wantedly',
});

function fakeStore(initial: Record<string, string> = {}): LimitStore {
  const data = new Map<string, number>(Object.entries(initial).map(([k, v]) => [k, Number(v)]));
  return {
    async incr(key) {
      const next = (data.get(key) ?? 0) + 1;
      data.set(key, next);
      return next;
    },
    async decr(key) {
      const next = (data.get(key) ?? 0) - 1;
      data.set(key, next);
      return next;
    },
    async expire() {
      return 1;
    },
    async get(key) {
      const value = data.get(key);
      return value === undefined ? null : String(value);
    },
  };
}

function memoryChannel(name: string, sink: NotificationMessage[]): NotificationChannel {
  return {
    name,
    async send(message) {
      sink.push(message);
    },
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function makeDeps(overrides: Partial<ProcessorDeps> & { sink?: NotificationMessage[] } = {}) {
  const sink = overrides.sink ?? [];
  const registry =
    overrides.registry ?? createNotificationRegistry([memoryChannel('mem', sink)]);
  const logger = overrides.logger ?? (makeLogger() as never);
  const deps: ProcessorDeps = {
    config,
    logger,
    registry,
    store: overrides.store ?? fakeStore(),
    queues: overrides.queues ?? new Map<QueueName, Queue>(),
    ...(overrides.discover !== undefined ? { discover: overrides.discover } : {}),
  };
  return { deps, sink, logger, registry };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return { id: 'job-1', name: 'scheduled-discovery', data: {}, ...overrides } as unknown as Job;
}

describe('createLimitGuardedProcessor', () => {
  it('passes work through when the limit is not exhausted', async () => {
    const logger = makeLogger();
    const { deps, sink } = makeDeps({ logger: logger as never });
    const processor = createLimitGuardedProcessor('jobDiscovery', deps);

    const result = await processor(makeJob());

    expect(result).toMatchObject({
      skipped: false,
      kind: 'jobDiscovery',
      used: 1,
      remaining: 0,
    });
    expect(sink).toHaveLength(0);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('skips with a warning notification when the limit is exhausted', async () => {
    const logger = makeLogger();
    const consumedKey = limitKey('jobDiscovery', utcDate());
    const { deps, sink } = makeDeps({
      logger: logger as never,
      store: fakeStore({ [consumedKey]: '1' }),
    });
    const processor = createLimitGuardedProcessor('jobDiscovery', deps);

    const result = await processor(makeJob());

    expect(result).toMatchObject({
      skipped: true,
      kind: 'jobDiscovery',
      used: 1,
      remaining: 0,
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(sink).toHaveLength(1);
    expect(sink[0]).toMatchObject({
      severity: 'warning',
      title: 'Daily limit reached: jobDiscovery',
    });
    expect(sink[0]?.body).toContain('1/1');
  });
});

describe('createJobDiscoveryProcessor', () => {
  it('crawls each configured source when the limit gate passes', async () => {
    const discover = vi.fn(async (sourceName: string): Promise<DiscoverySummary> => ({
      sourceName,
      fetched: 2,
      rejected: 0,
      created: 2,
      updated: 0,
      requirementCount: 3,
      healthy: true,
    }));
    const { deps } = makeDeps({ discover });
    const processor = createJobDiscoveryProcessor(deps);

    const result = await processor(makeJob());

    expect(discover).toHaveBeenCalledTimes(2);
    expect(discover).toHaveBeenCalledWith('remoteok');
    expect(discover).toHaveBeenCalledWith('wantedly');
    expect(result).toMatchObject({ skipped: false, kind: 'jobDiscovery' });
    expect(result.work).toMatchObject({ requested: 2, discovered: 2, failed: 0, created: 4 });
  });

  it('collects crashed sources without failing the run', async () => {
    const discover = vi.fn(async (sourceName: string) => {
      if (sourceName === 'remoteok') throw new Error('boom');
      return {
        sourceName,
        fetched: 1,
        rejected: 0,
        created: 1,
        updated: 0,
        requirementCount: 0,
        healthy: true,
      } satisfies DiscoverySummary;
    });
    const { deps } = makeDeps({ discover });
    const processor = createJobDiscoveryProcessor(deps);

    const result = await processor(makeJob());

    expect(result.work).toMatchObject({ requested: 2, discovered: 1, failed: 1, created: 1 });
    expect(result.work.results[0]).toMatchObject({
      source: 'remoteok',
      healthy: false,
      error: 'boom',
    });
  });

  it('prefers job-provided sources over the configured default', async () => {
    const discover = vi.fn(async (_sourceName: string): Promise<DiscoverySummary> => ({
      sourceName: 'any',
      fetched: 0,
      rejected: 0,
      created: 0,
      updated: 0,
      requirementCount: 0,
      healthy: true,
    }));
    const { deps } = makeDeps({ discover });
    const processor = createJobDiscoveryProcessor(deps);

    await processor(makeJob({ data: { sources: ['japan-dev'] } }));

    expect(discover).toHaveBeenCalledTimes(1);
    expect(discover).toHaveBeenCalledWith('japan-dev');
  });

  it('acknowledges when no JobService is wired', async () => {
    const { deps, logger } = makeDeps();
    const processor = createJobDiscoveryProcessor(deps);

    const result = await processor(makeJob());

    expect(result.work).toMatchObject({ wired: false });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('skips discovery entirely when the daily limit is exhausted', async () => {
    const discover = vi.fn();
    const consumedKey = limitKey('jobDiscovery', utcDate());
    const { deps, sink } = makeDeps({
      discover,
      store: fakeStore({ [consumedKey]: '1' }),
    });
    const processor = createJobDiscoveryProcessor(deps);

    const result = await processor(makeJob());

    expect(discover).not.toHaveBeenCalled();
    expect(result).toMatchObject({ skipped: true });
    expect(sink[0]).toMatchObject({
      severity: 'warning',
      title: 'Daily limit reached: jobDiscovery',
    });
  });
});

describe('createNotificationsProcessor', () => {
  it('builds the daily report from queue counts and limit usage, then fans it out', async () => {
    const discovery = {
      name: 'jobDiscovery',
      getJobCounts: vi
        .fn()
        .mockResolvedValue({ completed: 4, failed: 1, waiting: 2, active: 0 }),
    };
    const notifications = {
      name: 'notifications',
      getJobCounts: vi
        .fn()
        .mockResolvedValue({ completed: 1, failed: 0, waiting: 0, active: 0 }),
    };
    const queues = new Map<QueueName, Queue>([
      ['jobDiscovery', discovery as unknown as Queue],
      ['notifications', notifications as unknown as Queue],
    ]);
    const { deps, sink } = makeDeps({ queues });
    const processor = createNotificationsProcessor(deps);

    const result = await processor(makeJob({ name: 'daily-report' }));

    expect(discovery.getJobCounts).toHaveBeenCalledWith(
      'completed',
      'failed',
      'waiting',
      'active',
    );
    expect(sink).toHaveLength(1);
    const message = sink[0]!;
    expect(message.title).toMatch(/^Daily report — \d{4}-\d{2}-\d{2}$/);
    expect(message.body).toContain(
      '- jobDiscovery: 4 completed, 1 failed, 2 waiting, 0 active',
    );
    expect(message.body).toContain('- application: 0/1');
    // failures present, no exhausted limit
    expect(message.severity).toBe('warning');
    expect(result).toMatchObject({ severity: 'warning' });
  });

  it('delivers ad-hoc notification jobs through the registry', async () => {
    const { deps, sink } = makeDeps();
    const processor = createNotificationsProcessor(deps);

    await processor(
      makeJob({
        name: 'notify',
        data: { title: 'Heads up', body: 'something happened', severity: 'warning' },
      }),
    );

    expect(sink).toHaveLength(1);
    expect(sink[0]).toMatchObject({
      title: 'Heads up',
      body: 'something happened',
      severity: 'warning',
      at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });
});

describe('createLogOnlyProcessor', () => {
  it('acknowledges jobs without a domain handler', async () => {
    const logger = makeLogger();
    const { deps } = makeDeps({ logger: logger as never });
    const processor = createLogOnlyProcessor('aiMatching', deps);

    const result = await processor(makeJob({ name: 'scheduled-matching' }));

    expect(result).toEqual({ acknowledged: true });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'aiMatching', jobId: 'job-1' }),
      expect.any(String),
    );
  });
});
