import { parseEnv } from '@jobs-app/config';
import { createLogger } from '@jobs-app/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/server.js';

const config = parseEnv({ NODE_ENV: 'test' });

function stubProbes({ database = true, redis = true, ollama = true } = {}) {
  return {
    database: async () => database,
    redis: async () => redis,
    ollama: async () => ollama,
  };
}

afterAll(async () => {
  const app = buildApp({
    config,
    logger: createLogger({ service: 'api-test', level: 'silent' }),
    probes: stubProbes(),
  });
  await app.close();
});

describe('GET /health', () => {
  it('reports ok when all probes pass', async () => {
    const app = buildApp({
      config,
      logger: createLogger({ service: 'api-test', level: 'silent' }),
      probes: stubProbes(),
    });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.checks).toEqual({ database: 'ok', redis: 'ok', ollama: 'ok' });
    expect(body.service).toBe('api');
    expect(typeof body.version).toBe('string');
    await app.close();
  });

  it('reports degraded when a probe fails', async () => {
    const app = buildApp({
      config,
      logger: createLogger({ service: 'api-test', level: 'silent' }),
      probes: stubProbes({ database: false }),
    });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe('error');
    expect(body.checks.redis).toBe('ok');
    await app.close();
  });

  it('tolerates a thrown probe', async () => {
    const app = buildApp({
      config,
      logger: createLogger({ service: 'api-test', level: 'silent' }),
      probes: {
        database: async () => {
          throw new Error('db down');
        },
        redis: async () => true,
        ollama: async () => true,
      },
    });
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('degraded');
    await app.close();
  });
});

describe('error handler', () => {
  it('serializes unknown routes as 404', async () => {
    const app = buildApp({
      config,
      logger: createLogger({ service: 'api-test', level: 'silent' }),
      probes: stubProbes(),
    });
    const response = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});