import { describe, expect, it } from 'vitest';
import { loadConfig } from '@jobs-app/config';
import { buildApp } from '../src/server.js';

/**
 * Real-backend health check: exercises the actual PostgreSQL and Redis
 * connections via the app's default probes. Ollama is treated as optional so
 * this can run in CI environments without a local Ollama server.
 */
describe('GET /health (integration)', () => {
  it('reports healthy for the real database and redis', async () => {
    const config = loadConfig();
    const app = buildApp({ config });

    const response = await app.inject({ method: 'GET', url: '/health' });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.service).toBe('api');
    expect(body.checks).toEqual(
      expect.objectContaining({
        database: 'ok',
        redis: 'ok',
      }),
    );
    expect(['ok', 'degraded']).toContain(body.status);
    expect(typeof body.timestamp).toBe('string');
  });

  it('attaches a correlation id header', async () => {
    const config = loadConfig();
    const app = buildApp({ config });

    const response = await app.inject({ method: 'GET', url: '/health' });
    await app.close();

    const cid = response.headers['x-correlation-id'];
    expect(typeof cid).toBe('string');
    // fastify's genReqId() produces a fresh UUID v4 for every request.
    expect(cid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});