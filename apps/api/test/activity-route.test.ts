import { parseEnv } from '@jobs-app/config';
import { createLogger } from '@jobs-app/shared';
import { describe, expect, it } from 'vitest';
import type { ActivityHub } from '../src/activity.js';
import { buildApp } from '../src/server.js';
import type { WorkerActivityEvent } from '@jobs-app/shared';
import { makeEvent } from './activity-helpers.js';

const config = parseEnv({ NODE_ENV: 'test' });
const logger = createLogger({ service: 'api-test', level: 'silent' });
const probes = {
  database: async () => true,
  redis: async () => true,
  ollama: async () => true,
};

/**
 * Hermetic hub stand-in: never creates a redis client and never hits the
 * database, so the route contract is testable without services.
 */
function stubHub(initial: WorkerActivityEvent[] = []): ActivityHub {
  const events = [...initial];
  const listeners = new Set<(event: WorkerActivityEvent) => void>();
  return {
    list: () => [...events],
    ingest: (event) => {
      events.push(event);
      for (const listener of listeners) listener(event);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: async () => undefined,
    stop: async () => undefined,
  };
}

describe('GET /activity', () => {
  it('returns buffered activity newest-first', async () => {
    const hub = stubHub([
      makeEvent({ id: 'first', at: '2026-09-27T10:00:00.000Z' }),
      makeEvent({ id: 'second', at: '2026-09-27T10:00:01.000Z' }),
    ]);
    const app = buildApp({ config, logger, probes, activityHub: hub });
    const response = await app.inject({ method: 'GET', url: '/activity' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      items: Array<{ id: string }>;
      total: number;
      hasMore: boolean;
    };
    expect(body.total).toBe(2);
    expect(body.items.map((e) => e.id)).toEqual(['second', 'first']);
    await app.close();
  });

  it('returns an empty feed before any activity', async () => {
    const app = buildApp({ config, logger, probes, activityHub: stubHub() });
    const response = await app.inject({ method: 'GET', url: '/activity' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(JSON.stringify({ items: [], total: 0, hasMore: false }));
    await app.close();
  });
});
