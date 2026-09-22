import type { FastifyInstance } from 'fastify';
import { parseListQuery, paginate, parseSort, toBoolean, type SortDirection } from './lib.js';
import type { RouteContext } from './context.js';

interface MatchListItem {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  totalScore: number;
  eligible: boolean;
  confidence: number;
  createdAt: string;
  dimensions: Array<{ key: string; weight: number; score: number; status: string; detail: string | null }>;
}

export function registerMatchesRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get('/matches', async (request): Promise<{ items: MatchListItem[]; total: number; page: number; limit: number; hasMore: boolean }> => {
    const db = await context.db();
    const query = request.query as Record<string, string | string[] | undefined>;
    const list = parseListQuery(query);
    const minScore = query.minScore !== undefined ? Number.parseFloat(String(query.minScore)) : undefined;
    const eligible = query.eligible !== undefined ? toBoolean(query.eligible, true) : undefined;
    const sort = parseSort(list.sort, 'totalScore');
    const orderBy: Record<string, SortDirection>[] = [{ [sort.field]: sort.dir }];

    const where = {
      ...(minScore !== undefined && !Number.isNaN(minScore) ? { totalScore: { gte: minScore } } : {}),
      ...(eligible !== undefined ? { eligible } : {}),
      ...(list.search !== undefined
        ? {
            OR: [
              { jobTitle: { contains: list.search, mode: 'insensitive' as const } },
              { company: { contains: list.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.jobMatch.findMany({
        where,
        include: { dimensions: { orderBy: { weight: 'desc' } } },
        orderBy,
        skip: list.offset,
        take: list.limit,
      }),
      db.jobMatch.count({ where }),
    ]);

    const page = Math.floor(list.offset / list.limit) + 1;
    return paginate(
      rows.map((match) => ({
        id: match.id,
        jobId: match.jobId,
        jobTitle: match.jobTitle,
        company: match.company,
        totalScore: match.totalScore,
        eligible: match.eligible,
        confidence: match.confidence,
        createdAt: match.createdAt.toISOString(),
        dimensions: match.dimensions.map((dimension) => ({
          key: dimension.key,
          weight: dimension.weight,
          score: dimension.score,
          status: dimension.status,
          detail: dimension.detail,
        })),
      })),
      total,
      page,
      list.limit,
    );
  });
}