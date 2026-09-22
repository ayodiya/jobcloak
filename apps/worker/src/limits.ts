import type { Env } from '@jobs-app/config';
import type { Redis } from 'ioredis';

export type LimitKind = 'jobDiscovery' | 'applicationPreparation' | 'application';

export const LIMIT_KINDS: readonly LimitKind[] = [
  'jobDiscovery',
  'applicationPreparation',
  'application',
];

export interface LimitDecision {
  kind: LimitKind;
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  /** `limits:<kind>:<YYYY-MM-DD>` (UTC day). */
  key: string;
  date: string;
}

/**
 * Minimal counter contract so tests run against an in-memory fake while
 * production wraps a single shared ioredis client. Structurally satisfied by
 * the ioredis methods of the same name.
 */
export interface LimitStore {
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
}

/** UTC calendar day — the budget window is UTC so runs are reproducible. */
export function utcDate(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

export function limitKey(kind: LimitKind, date: string): string {
  return `limits:${kind}:${date}`;
}

export function limitFor(config: Env, kind: LimitKind): number {
  switch (kind) {
    case 'jobDiscovery':
      return config.JOB_DISCOVERY_DAILY_LIMIT;
    case 'applicationPreparation':
      return config.APPLICATION_PREPARATION_DAILY_LIMIT;
    case 'application':
      return config.APPLICATION_DAILY_LIMIT;
  }
}

/** Keep counters two days so a report just after midnight can still read yesterday. */
const LIMIT_TTL_SECONDS = 2 * 24 * 60 * 60;

/**
 * Atomically claim one unit of the daily budget. The counter only tracks
 * accepted usage: an attempt past the limit is rolled back so `get` never
 * reports a number above the cap.
 */
export async function consumeLimit(
  store: LimitStore,
  config: Env,
  kind: LimitKind,
  at: Date = new Date(),
): Promise<LimitDecision> {
  const date = utcDate(at);
  const key = limitKey(kind, date);
  const limit = limitFor(config, kind);
  const attempted = await store.incr(key);
  if (attempted === 1) {
    await store.expire(key, LIMIT_TTL_SECONDS);
  }
  if (attempted > limit) {
    await store.decr(key);
    return { kind, allowed: false, used: limit, limit, remaining: 0, key, date };
  }
  return {
    kind,
    allowed: true,
    used: attempted,
    limit,
    remaining: limit - attempted,
    key,
    date,
  };
}

/** Read current usage without consuming budget (used by the daily report). */
export async function peekLimit(
  store: LimitStore,
  config: Env,
  kind: LimitKind,
  at: Date = new Date(),
): Promise<{ kind: LimitKind; used: number; limit: number }> {
  const raw = await store.get(limitKey(kind, utcDate(at)));
  return { kind, used: raw ? Number(raw) : 0, limit: limitFor(config, kind) };
}

export function redisLimitStore(client: Redis): LimitStore {
  return {
    incr: (key) => client.incr(key),
    decr: (key) => client.decr(key),
    expire: (key, ttl) => client.expire(key, ttl),
    get: (key) => client.get(key),
  };
}
