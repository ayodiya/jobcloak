import type { FastifyInstance } from 'fastify';
import type { RouteContext } from './context.js';

export interface DashboardResponse {
  generatedAt: string;
  counts: {
    jobs: number;
    activeJobs: number;
    matchesEligible: number;
    applicationsByStatus: Record<string, number>;
    materials: number;
    sourcesHealthy: number;
    sourcesTotal: number;
  };
  recentApplications: Array<{
    id: string;
    status: string;
    mode: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    job: { id: string; title: string; company: string; remote: boolean; location: string | null; url: string };
  }>;
  topMatches: Array<{
    matchId: string;
    jobId: string;
    jobTitle: string;
    company: string;
    totalScore: number;
    eligible: boolean;
    confidence: number;
  }>;
  automation: {
    blockedEvents: number;
    inQueue: number;
  };
}

export function registerDashboardRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get('/dashboard', async (): Promise<DashboardResponse> => {
    const db = await context.db();
    const statuses = ['Prepared', 'InProgress', 'Submitted', 'Verified', 'Failed', 'Cancelled', 'Rejected'] as const;

    const [jobTotal, activeJobs, matchesEligible, materials, sources, statusGroups, recent, topMatches, blockedEvents, queue] =
      await Promise.all([
        db.job.count(),
        db.job.count({ where: { status: 'Active' } }),
        db.jobMatch.count({ where: { eligible: true } }),
        db.applicationMaterial.count(),
        db.sourceHealth.findMany(),
        db.application.groupBy({ by: ['status'], _count: { _all: true } }),
        db.application.findMany({
          include: {
            job: { select: { id: true, title: true, company: true, remote: true, location: true, url: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 5,
        }),
        db.jobMatch.findMany({
          where: { eligible: true },
          orderBy: [{ totalScore: 'desc' }, { createdAt: 'asc' }],
          take: 5,
        }),
        db.applicationEvent.count({
          where: { type: { in: ['gate.detected', 'submission.blocked'] } },
        }),
        db.application.count({ where: { status: { in: ['Prepared', 'InProgress'] } } }),
      ]);

    const applicationsByStatus: Record<string, number> = Object.fromEntries(statuses.map((status) => [status, 0]));
    for (const group of statusGroups) {
      applicationsByStatus[group.status] = group._count._all;
    }

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        jobs: jobTotal,
        activeJobs,
        matchesEligible,
        applicationsByStatus,
        materials,
        sourcesHealthy: sources.filter((source) => source.healthy).length,
        sourcesTotal: sources.length,
      },
      recentApplications: recent.map((application) => ({
        id: application.id,
        status: application.status,
        mode: application.mode,
        url: application.url,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        job: application.job,
      })),
      topMatches: topMatches.map((match) => ({
        matchId: match.id,
        jobId: match.jobId,
        jobTitle: match.jobTitle,
        company: match.company,
        totalScore: match.totalScore,
        eligible: match.eligible,
        confidence: match.confidence,
      })),
      automation: {
        blockedEvents,
        inQueue: queue,
      },
    };
  });
}