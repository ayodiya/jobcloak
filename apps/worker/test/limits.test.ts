import { parseEnv } from '@jobs-app/config';
import { describe, expect, it } from 'vitest';
import {
  consumeLimit,
  limitKey,
  peekLimit,
  utcDate,
  type LimitStore,
} from '../src/limits.js';

const config = parseEnv({
  JOB_DISCOVERY_DAILY_LIMIT: '2',
  APPLICATION_PREPARATION_DAILY_LIMIT: '3',
  APPLICATION_DAILY_LIMIT: '1',
});

function fakeStore(): LimitStore & {
  data: Map<string, number>;
  expireCalls: string[];
} {
  const data = new Map<string, number>();
  const expireCalls: string[] = [];
  return {
    data,
    expireCalls,
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
    async expire(key) {
      expireCalls.push(key);
      return 1;
    },
    async get(key) {
      const value = data.get(key);
      return value === undefined ? null : String(value);
    },
  };
}

describe('consumeLimit', () => {
  it('allows work up to the limit and rejects the attempt past it with rollback', async () => {
    const store = fakeStore();
    const at = new Date('2026-09-11T10:00:00.000Z');

    const first = await consumeLimit(store, config, 'jobDiscovery', at);
    expect(first).toMatchObject({ allowed: true, used: 1, remaining: 1, date: '2026-09-11' });

    const second = await consumeLimit(store, config, 'jobDiscovery', at);
    expect(second).toMatchObject({ allowed: true, used: 2, remaining: 0 });

    const third = await consumeLimit(store, config, 'jobDiscovery', at);
    expect(third).toMatchObject({ allowed: false, used: 2, remaining: 0, limit: 2 });
    // rejected attempt must not consume budget
    expect(store.data.get('limits:jobDiscovery:2026-09-11')).toBe(2);
  });

  it('writes the documented key and sets the TTL only when the counter is created', async () => {
    const store = fakeStore();
    const at = new Date('2026-09-11T10:00:00.000Z');

    await consumeLimit(store, config, 'jobDiscovery', at);
    expect(store.expireCalls).toEqual(['limits:jobDiscovery:2026-09-11']);

    await consumeLimit(store, config, 'jobDiscovery', at);
    expect(store.expireCalls).toHaveLength(1);
  });

  it('rolls the counter at the UTC date boundary', async () => {
    const store = fakeStore();
    const before = await consumeLimit(
      store,
      config,
      'application',
      new Date('2026-09-11T23:59:59.000Z'),
    );
    expect(before).toMatchObject({ allowed: true, date: '2026-09-11' });

    const after = await consumeLimit(
      store,
      config,
      'application',
      new Date('2026-09-12T00:00:01.000Z'),
    );
    expect(after).toMatchObject({ allowed: true, used: 1, date: '2026-09-12' });
    expect(store.data.get('limits:application:2026-09-11')).toBe(1);
    expect(store.data.get('limits:application:2026-09-12')).toBe(1);
  });
});

describe('peekLimit', () => {
  it('reads usage without consuming budget', async () => {
    const store = fakeStore();
    const at = new Date('2026-09-11T10:00:00.000Z');

    expect(await peekLimit(store, config, 'application', at)).toEqual({
      kind: 'application',
      used: 0,
      limit: 1,
    });

    await consumeLimit(store, config, 'application', at);
    expect(await peekLimit(store, config, 'application', at)).toEqual({
      kind: 'application',
      used: 1,
      limit: 1,
    });
    expect(store.data.get('limits:application:2026-09-11')).toBe(1);
  });
});

describe('utcDate / limitKey', () => {
  it('formats the UTC day and documented key', () => {
    expect(utcDate(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02');
    expect(limitKey('jobDiscovery', '2026-01-02')).toBe('limits:jobDiscovery:2026-01-02');
  });
});
