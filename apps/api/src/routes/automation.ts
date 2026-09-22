import { NotFoundError } from '@jobs-app/shared';
import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context.js';

interface AutomationResponse {
  generatedAt: string;
  profilePresent: boolean;
  pipeline: {
    reviewMode: boolean;
    sourcesHealthy: number;
    sourcesTotal: number;
    jobsActive: number;
    matchesEligible: number;
    prepared: number;
    inProgress: number;
    inQueue: number;
    submitted: number;
    verified: number;
    failed: number;
    cancelled: number;
    rejected: number;
    blockedEvents: number;
    submissionKeyed: number;
  };
  recentBlocked: Array<{
    applicationId: string;
    jobTitle: string | null;
    company: string | null;
    eventType: string;
    stage: string | null;
    payload: unknown;
    at: string;
  }>;
}

const ACTIVE = ['Prepared', 'InProgress'];
const BLOCKED_TYPES = ['gate.detected', 'submission.blocked'];

export function registerAutomationRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get('/automation', async (): Promise<AutomationResponse> => {
    const db = await context.db();
    const profile = await db.candidateProfile.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!profile) throw new NotFoundError('No candidate profile found (run the seed)');

    const [sources, activeJobs, matchesEligible, statusGroups, blockedEvents, submissionKeyed, recentBlocked] = await Promise.all([
      db.sourceHealth.findMany(),
      db.job.count({ where: { status: 'Active' } }),
      db.jobMatch.count({ where: { eligible: true } }),
      db.application.groupBy({ by: ['status'], _count: { _all: true } }),
      db.applicationEvent.count({ where: { type: { in: BLOCKED_TYPES } } }),
      db.application.count({ where: { submissionKey: { not: null } } }),
      db.applicationEvent.findMany({
        where: { type: { in: BLOCKED_TYPES } },
        include: { application: { select: { jobId: true, status: true } } },
        orderBy: { at: 'desc' },
        take: 5,
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const group of statusGroups) byStatus[group.status] = group._count._all;

    // Resolve blocked event jobs to their title/company for the readout.
    const jobIds = Array.from(new Set(recentBlocked.map((event) => event.application.jobId).filter(Boolean)));
    const jobs = jobIds.length > 0
      ? await db.job.findMany({ where: { id: { in: jobIds } }, select: { id: true, title: true, company: true } })
      : [];
    const jobById = new Map(jobs.map((job) => [job.id, job]));

    return {
      generatedAt: new Date().toISOString(),
      profilePresent: true,
      pipeline: {
        reviewMode: true,
        sourcesHealthy: sources.filter((source) => source.healthy).length,
        sourcesTotal: sources.length,
        jobsActive: activeJobs,
        matchesEligible,
        prepared: byStatus['Prepared'] ?? 0,
        inProgress: byStatus['InProgress'] ?? 0,
        inQueue: ACTIVE.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0),
        submitted: byStatus['Submitted'] ?? 0,
        verified: byStatus['Verified'] ?? 0,
        failed: byStatus['Failed'] ?? 0,
        cancelled: byStatus['Cancelled'] ?? 0,
        rejected: byStatus['Rejected'] ?? 0,
        blockedEvents,
        submissionKeyed,
      },
      recentBlocked: recentBlocked.map((event) => {
        const job = event.application.jobId ? jobById.get(event.application.jobId) : undefined;
        return {
          applicationId: event.applicationId,
          jobTitle: job?.title ?? null,
          company: job?.company ?? null,
          eventType: event.type,
          stage: event.stage,
          payload: event.payload,
          at: event.at.toISOString(),
        };
      }),
    };
  });
}