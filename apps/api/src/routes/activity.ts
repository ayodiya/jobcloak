import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WorkerActivityEvent } from '@jobs-app/shared';
import { ACTIVITY_HISTORY_LIMIT, type ActivityHub } from '../activity.js';
import type { RouteContext } from './context.js';

/** Events replayed to a freshly-connected SSE client. */
const STREAM_REPLAY_LIMIT = 50;
const HEARTBEAT_INTERVAL_MS = 15_000;

export function registerActivityRoutes(
  app: FastifyInstance,
  context: RouteContext,
  hub: ActivityHub,
): void {
  app.get('/activity', async () => {
    await ensureHubStarted(app, context, hub);
    const items = hub.list();
    return {
      items: [...items].reverse(),
      total: items.length,
      hasMore: false,
    };
  });

  app.get('/activity/stream', async (request, reply) => {
    await ensureHubStarted(app, context, hub);
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      // hijack() bypasses the fastify CORS hook, so the ACAO header must be
      // emitted with the stream headers themselves.
      'access-control-allow-origin': corsOrigin(request, context),
      vary: 'Origin',
    });
    raw.write('retry: 3000\n\n');

    const send = (event: WorkerActivityEvent): void => {
      raw.write(`event: activity\ndata: ${JSON.stringify(event)}\n\n`);
    };

    for (const event of hub.list().slice(-STREAM_REPLAY_LIMIT)) send(event);
    const unsubscribe = hub.subscribe(send);

    const heartbeat = setInterval(() => {
      try {
        raw.write(': ping\n\n');
      } catch {
        // socket closed; cleanup below tears the client out
      }
    }, HEARTBEAT_INTERVAL_MS);

    const cleanup = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    request.raw.on('close', cleanup);
  });
}

/**
 * Mirror of the @fastify/cors policy for the hijacked SSE response: reflect
 * the request origin in development, lock to WEB_ORIGIN in production.
 */
function corsOrigin(request: FastifyRequest, context: RouteContext): string {
  if (context.config.NODE_ENV === 'production') return context.config.WEB_ORIGIN;
  return request.headers.origin ?? '*';
}

/**
 * Connect the hub subscriber once (with durable-history seeding from the
 * audit trail). Failures degrade gracefully: the stream still replays
 * whatever the hub has buffered instead of 500ing the dashboard.
 */
async function ensureHubStarted(
  app: FastifyInstance,
  context: RouteContext,
  hub: ActivityHub,
): Promise<void> {
  try {
    await hub.start(async () => {
      const db = await context.db();
      const rows = await db.auditLog.findMany({
        where: { action: { startsWith: 'worker.' } },
        orderBy: [{ createdAt: 'desc' }],
        take: ACTIVITY_HISTORY_LIMIT,
      });
      return rows.map(mapAuditToEvent);
    });
  } catch (error) {
    app.log.warn({ error }, 'activity subscriber unavailable; serving from buffer');
  }
}

function mapAuditToEvent(row: {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
}): WorkerActivityEvent {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const outcome =
    (['completed', 'skipped', 'failed'] as const).find((o) => row.action === `worker.${o}`) ??
    'completed';
  return {
    id: row.id,
    queue: row.entityType ?? 'unknown',
    jobId: row.entityId ?? '',
    jobName: typeof meta.jobName === 'string' ? meta.jobName : 'unknown',
    outcome,
    at: row.createdAt.toISOString(),
    durationMs: typeof meta.durationMs === 'number' ? meta.durationMs : null,
    error: typeof meta.error === 'string' ? meta.error : null,
    detail: typeof meta.detail === 'string' ? meta.detail : null,
  };
}
