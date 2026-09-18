import type { Env } from '@jobs-app/config';
import { createLogger, newId, type Logger } from '@jobs-app/shared';
import type { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { makeErrorHandler } from './error-handler.js';
import { registerHealthRoutes, type SystemProbes } from './routes/health.js';

export interface AppDeps {
  config: Env;
  logger?: Logger;
  /**
   * Injectable probes for health checks. Defaults probe the real services;
   * tests inject deterministic stubs.
   */
  probes?: Partial<SystemProbes>;
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const config = deps.config;
  const logger = deps.logger ?? createLogger({ service: 'api', level: config.LOG_LEVEL });

  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    trustProxy: true,
    genReqId: () => newId(),
    bodyLimit: 2 * 1024 * 1024,
  });

  app.setErrorHandler(
    makeErrorHandler({
      log: (obj, msg) => logger.error(obj, msg),
    }),
  );

  // Correlation id per request: exposed on responses and usable by handlers as
  // `request.id` when tagging audit/domain logs.
  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-correlation-id', request.id);
  });

  // CORS for the local dashboard. Production deployments lock the origin from
  // WEB_ORIGIN; development/dev-tooling origins are tolerated for convenience.
  void app.register(cors, {
    ...(config.NODE_ENV === 'production'
      ? { origin: config.WEB_ORIGIN }
      : { origin: true }),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
  });

  const probes: SystemProbes = {
    database: deps.probes?.database ?? defaultDatabaseProbe(),
    redis: deps.probes?.redis ?? defaultRedisProbe(config),
    ollama: deps.probes?.ollama ?? defaultOllamaProbe(config),
  };

  void registerHealthRoutes(app, probes);

  return app;
}

function defaultDatabaseProbe(): () => Promise<boolean> {
  let client: PrismaClient | undefined;
  return async () => {
    try {
      const { createPrismaClient } = await import('@jobs-app/database');
      client ??= createPrismaClient();
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    } finally {
      if (client) {
        await client.$disconnect().catch(() => undefined);
        client = undefined;
      }
    }
  };
}

function defaultRedisProbe(config: Env): () => Promise<boolean> {
  return async () => {
    const redis = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await redis.connect();
      const pong = await redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    } finally {
      redis.disconnect();
    }
  };
}

function defaultOllamaProbe(config: Env): () => Promise<boolean> {
  return async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${config.OLLAMA_BASE_URL}/api/version`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  };
}

export async function startServer(deps: AppDeps): Promise<FastifyInstance> {
  const app = buildApp(deps);
  const { config, logger } = deps;
  const loggerLocal = logger ?? createLogger({ service: 'api', level: deps.config.LOG_LEVEL });
  try {
    await app.listen({ host: config.API_HOST, port: config.API_PORT });
    loggerLocal.info({ host: config.API_HOST, port: config.API_PORT }, 'api listening');
  } catch (error) {
    loggerLocal.error({ error }, 'api failed to start');
    throw error;
  }
  return app;
}