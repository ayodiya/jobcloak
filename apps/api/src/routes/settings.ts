import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context.js';

export function registerSettingsRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get('/settings', async () => {
    const db = await context.db();
    const [sources, counts] = await Promise.all([
      db.sourceHealth.findMany(),
      db.application.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const applicationsByStatus: Record<string, number> = {};
    for (const group of counts) applicationsByStatus[group.status] = group._count._all;

    return {
      mode: 'review',
      generatedAt: new Date().toISOString(),
      environment: {
        nodeEnv: context.config.NODE_ENV,
        apiHost: context.config.API_HOST,
        apiPort: context.config.API_PORT,
        webOrigin: context.config.WEB_ORIGIN,
      },
      automation: {
        sourcesHealthy: sources.filter((source) => source.healthy).length,
        sourcesTotal: sources.length,
        clients: sources.map((source) => source.sourceName),
      },
      countsPresence: {
        applications: applicationsByStatus,
      },
    };
  });
}