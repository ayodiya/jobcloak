import { ApplicationRepository, ApplicationService, isApplicationStatus } from '@jobs-app/applications';
import { NotFoundError, ValidationError } from '@jobs-app/shared';
import type { ApplicationStatus, Prisma } from '@jobs-app/database';
import type { FastifyInstance } from 'fastify';
import { parseListQuery, paginate, csv, parseSort } from './lib.js';
import type { RouteContext } from './context.js';

interface ApplicationListItemJson {
  id: string;
  status: string;
  mode: string;
  sourceName: string | null;
  url: string;
  submissionKey: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  job: { id: string; title: string; company: string; remote: boolean; location: string | null; url: string };
}

interface ApplicationDetailJson extends ApplicationListItemJson {
  jobId: string;
  profileId: string;
  events: Array<{ id: string; type: string; stage: string | null; payload: unknown; at: string }>;
}

export function registerApplicationsRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get('/applications', async (request): Promise<{ items: ApplicationListItemJson[]; total: number; page: number; limit: number; hasMore: boolean }> => {
    const db = await context.db();
    const query = request.query as Record<string, string | string[] | undefined>;
    const list = parseListQuery(query);
    const statuses = csv(query.status) as ApplicationStatus[];
    const modes = csv(query.mode);
    const sort = parseSort(list.sort, 'createdAt');
    const orderBy: Prisma.ApplicationOrderByWithRelationInput[] = [
      ...(sort.field === 'jobTitle'
        ? [{ job: { title: sort.dir } }]
        : [{ [sort.field]: sort.dir }, { id: 'asc' as const }]),
    ];

    const where = {
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(modes.length > 0 ? { mode: { in: modes } } : {}),
      ...(list.search !== undefined
        ? {
            OR: [
              { job: { title: { contains: list.search, mode: 'insensitive' as const } } },
              { job: { company: { contains: list.search, mode: 'insensitive' as const } } },
              { sourceName: { contains: list.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.application.findMany({
        where,
        include: {
          job: { select: { id: true, title: true, company: true, remote: true, location: true, url: true } },
        },
        orderBy,
        skip: list.offset,
        take: list.limit,
      }),
      db.application.count({ where }),
    ]);

    const page = Math.floor(list.offset / list.limit) + 1;
    return paginate(rows.map(toListItemJson), total, page, list.limit);
  });

  app.get('/applications/:id', async (request): Promise<ApplicationDetailJson> => {
    const db = await context.db();
    const service = new ApplicationService(new ApplicationRepository(db));
    const params = request.params as { id: string };
    const application = await service.getApplication(params.id).catch(() => null);
    if (!application) {
      throw new NotFoundError(`Application not found: ${params.id}`);
    }
    const job = await db.job.findUnique({
      where: { id: application.jobId },
      select: { id: true, title: true, company: true, remote: true, location: true, url: true },
    });
    return toDetailJson(application, job ?? undefined);
  });

  app.patch('/applications/:id/status', async (request): Promise<{ application: ApplicationDetailJson }> => {
    const db = await context.db();
    const service = new ApplicationService(new ApplicationRepository(db));
    const params = request.params as { id: string };
    const body = request.body as { to?: unknown };
    if (!body || typeof body.to !== 'string') {
      throw new ValidationError('body.to (application status) is required');
    }
    if (!isApplicationStatus(body.to)) {
      throw new ValidationError(`Unknown application status: ${body.to}`);
    }
    const updated = await service.transition(params.id, body.to);
    return { application: toDetailJson(updated) };
  });
}

function toListItemJson(row: {
  id: string;
  status: string;
  mode: string;
  sourceName: string | null;
  url: string;
  submissionKey: string | null;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  job: { id: string; title: string; company: string; remote: boolean; location: string | null; url: string };
}): ApplicationListItemJson {
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    sourceName: row.sourceName,
    url: row.url,
    submissionKey: row.submissionKey,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    job: row.job,
  };
}

function toDetailJson(
  application: {
    id: string;
    profileId: string;
    jobId: string;
    status: string;
    mode: string;
    sourceName: string | null;
    url: string;
    submissionKey: string | null;
    submittedAt: Date | null;
    verifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    events: Array<{ id: string; type: string; stage: string | null; payload: unknown; at: Date }>;
  },
  job?: { id: string; title: string; company: string; remote: boolean; location: string | null; url: string },
): ApplicationDetailJson {
  return {
    id: application.id,
    profileId: application.profileId,
    jobId: application.jobId,
    status: application.status,
    mode: application.mode,
    sourceName: application.sourceName,
    url: application.url,
    submissionKey: application.submissionKey,
    submittedAt: application.submittedAt?.toISOString() ?? null,
    verifiedAt: application.verifiedAt?.toISOString() ?? null,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    job: job ?? { id: application.jobId, title: '', company: '', remote: false, location: null, url: '' },
    events: application.events.map((event) => ({
      id: event.id,
      type: event.type,
      stage: event.stage,
      payload: event.payload,
      at: event.at.toISOString(),
    })),
  };
}