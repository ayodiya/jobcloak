import type { FastifyInstance } from 'fastify';
import { parseListQuery } from './lib.js';
import type { RouteContext } from './context.js';

export function registerSourcesRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get('/sources', async (request) => {
    const db = await context.db();
    const query = request.query as Record<string, string | string[] | undefined>;
    const list = parseListQuery(query);
    const healthy = query.healthy !== undefined ? query.healthy !== 'false' : undefined;

    const where = {
      ...(healthy !== undefined ? { healthy } : {}),
      ...(list.search !== undefined ? { sourceName: { contains: list.search, mode: 'insensitive' as const } } : {}),
    };

    const [sources, jobsBySource, totalSources] = await Promise.all([
      db.sourceHealth.findMany({
        where,
        orderBy: { sourceName: 'asc' },
      }),
      db.job.groupBy({ by: ['sourceName'], _count: { _all: true } }),
      db.sourceHealth.count({ where }),
    ]);

    const counts = new Map(jobsBySource.map((group) => [group.sourceName, group._count._all]));
    return {
      items: sources.map((source) => ({
        sourceName: source.sourceName,
        healthy: source.healthy,
        consecutiveFailures: source.consecutiveFailures,
        lastError: source.lastError,
        lastCheckedAt: source.lastCheckedAt?.toISOString() ?? null,
        lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null,
        jobsCount: counts.get(source.sourceName) ?? 0,
      })),
      total: totalSources,
      limit: list.limit,
    };
  });
}