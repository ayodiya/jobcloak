import { NotFoundError } from '@jobs-app/shared';
import type { JobStatus } from '@jobs-app/database';
import type { FastifyInstance } from 'fastify';
import { parseListQuery, paginate, parseSort, csv, toBoolean, type SortDirection } from './lib.js';
import type { RouteContext } from './context.js';

const JOB_SORT_FIELDS = ['title', 'company', 'remote', 'status', 'postedAt', 'discoveredAt', 'lastSeenAt'];

interface JobListItem {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  url: string;
  normalizedUrl: string;
  status: string;
  postedAt: string | null;
  discoveredAt: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  requirementsCount: number;
  match: { id: string; totalScore: number; eligible: boolean } | null;
}

interface JobDetail extends JobListItem {
  sourceName: string;
  description: string;
  employmentType: string | null;
  seniority: string | null;
  lastSeenAt: string;
  requirements: Array<{
    kind: string;
    category: string;
    key: string;
    name: string;
    minYears: number | null;
  }>;
  matchDimensions: Array<{
    key: string;
    weight: number;
    score: number;
    applicable: boolean;
    status: string;
    detail: string | null;
  }>;
  applicationsCount: number;
}

export function registerJobsRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get('/jobs', async (request): Promise<{ items: JobListItem[]; total: number; page: number; limit: number; hasMore: boolean }> => {
    const db = await context.db();
    const query = request.query as Record<string, string | string[] | undefined>;
    const list = parseListQuery(query);
    const statuses = csv(query.status) as JobStatus[];
    const remote = query.remote !== undefined ? toBoolean(query.remote, false) : undefined;
    const sort = parseSort(list.sort, 'discoveredAt');
    const safeField = JOB_SORT_FIELDS.includes(sort.field) ? sort.field : 'discoveredAt';
    const jobSort: Record<string, SortDirection>[] = [{ [safeField]: sort.dir }];
    const where = {
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(remote !== undefined ? { remote } : {}),
      ...(list.search !== undefined
        ? {
            OR: [
              { title: { contains: list.search, mode: 'insensitive' as const } },
              { company: { contains: list.search, mode: 'insensitive' as const } },
              { location: { contains: list.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.job.findMany({
        where,
        include: { match: { select: { id: true, totalScore: true, eligible: true } }, _count: { select: { requirements: true } } },
        orderBy: jobSort,
        skip: list.offset,
        take: list.limit,
      }),
      db.job.count({ where }),
    ]);

    const page = Math.floor(list.offset / list.limit) + 1;
    return paginate(
      rows.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        remote: job.remote,
        url: job.url,
        normalizedUrl: job.normalizedUrl,
        status: job.status,
        postedAt: job.postedAt?.toISOString() ?? null,
        discoveredAt: job.discoveredAt.toISOString(),
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        requirementsCount: job._count.requirements,
        match: job.match,
      })),
      total,
      page,
      list.limit,
    );
  });

  app.get('/jobs/:id', async (request): Promise<JobDetail> => {
    const db = await context.db();
    const params = request.params as { id: string };
    const job = await db.job.findUnique({
      where: { id: params.id },
      include: {
        requirements: { orderBy: [{ kind: 'asc' }, { category: 'asc' }] },
        match: { include: { dimensions: { orderBy: { weight: 'desc' } } } },
        _count: { select: { applications: true } },
      },
    });
    if (!job) throw new NotFoundError(`Job not found: ${params.id}`);
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      remote: job.remote,
      url: job.url,
      normalizedUrl: job.normalizedUrl,
      status: job.status,
      postedAt: job.postedAt?.toISOString() ?? null,
      discoveredAt: job.discoveredAt.toISOString(),
      lastSeenAt: job.lastSeenAt.toISOString(),
      sourceName: job.sourceName,
      description: job.description,
      employmentType: job.employmentType,
      seniority: job.seniority,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      requirementsCount: job.requirements.length,
      requirements: job.requirements.map((requirement) => ({
        kind: requirement.kind,
        category: requirement.category,
        key: requirement.key,
        name: requirement.name,
        minYears: requirement.minYears,
      })),
      match:
        job.match === null
          ? null
          : {
              id: job.match.id,
              totalScore: job.match.totalScore,
              eligible: job.match.eligible,
            },
      matchDimensions:
        job.match?.dimensions.map((dimension) => ({
          key: dimension.key,
          weight: dimension.weight,
          score: dimension.score,
          applicable: dimension.applicable,
          status: dimension.status,
          detail: dimension.detail,
        })) ?? [],
      applicationsCount: job._count.applications,
    };
  });
}