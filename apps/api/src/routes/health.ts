import { SERVICE_VERSION } from '@jobs-app/shared';
import type { FastifyInstance } from 'fastify';

export interface SystemProbes {
  database: () => Promise<boolean>;
  redis: () => Promise<boolean>;
  ollama: () => Promise<boolean>;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  checks: Record<string, 'ok' | 'error'>;
}

export async function registerHealthRoutes(app: FastifyInstance, probes: SystemProbes): Promise<void> {
  app.get('/health', async (): Promise<HealthResponse> => {
    const entries = await Promise.allSettled([
      probes.database(),
      probes.redis(),
      probes.ollama(),
    ]);
    const ok = (entry: PromiseSettledResult<boolean> | undefined): 'ok' | 'error' =>
      entry?.status === 'fulfilled' && entry.value ? 'ok' : 'error';
    const checks: Record<string, 'ok' | 'error'> = {
      database: ok(entries[0]),
      redis: ok(entries[1]),
      ollama: ok(entries[2]),
    };
    return {
      status: Object.values(checks).every((c) => c === 'ok') ? 'ok' : 'degraded',
      service: 'api',
      version: SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      checks,
    };
  });
}