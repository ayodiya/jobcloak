import type { FastifyInstance } from 'fastify';
import { parseListQuery, csv, parseSort, paginate, type SortDirection } from './lib.js';
import type { RouteContext } from './context.js';

interface AuditItem {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  correlationId: string | null;
  metadata: unknown;
  createdAt: string;
}

export function registerAuditRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get('/audit', async (request): Promise<{ items: AuditItem[]; total: number; page: number; limit: number; hasMore: boolean }> => {
    const db = await context.db();
    const query = request.query as Record<string, string | string[] | undefined>;
    const list = parseListQuery(query);
    const entityTypes = csv(query.entityType);
    const actions = csv(query.action);
    const sort = parseSort(list.sort, 'createdAt');
    const orderBy: Record<string, SortDirection>[] = [{ [sort.field]: sort.dir }, { id: 'desc' }];

    const where = {
      ...(entityTypes.length > 0 ? { entityType: { in: entityTypes } } : {}),
      ...(actions.length > 0 ? { action: { in: actions } } : {}),
      ...(list.search !== undefined
        ? {
            OR: [
              { action: { contains: list.search, mode: 'insensitive' as const } },
              { entityId: { contains: list.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.auditLog.findMany({ where, orderBy, skip: list.offset, take: list.limit }),
      db.auditLog.count({ where }),
    ]);

    const page = Math.floor(list.offset / list.limit) + 1;
    return paginate(
      rows.map((row): AuditItem => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        correlationId: row.correlationId,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      list.limit,
    );
  });
}