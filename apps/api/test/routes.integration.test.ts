import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '@jobs-app/config';
import { prisma } from '@jobs-app/database';
import { ApplicationService } from '@jobs-app/applications';
import { buildApp } from '../src/server.js';

const COMPANY = 'RoutesCo';

function app() {
  return buildApp({ config: loadConfig(), db: prisma });
}

describe('dashboard routes (integration)', () => {
  let profileId: string;
  let jobId: string;
  let transitionJobId: string;
  let applicationId: string;
  let transitionApplicationId: string;

  beforeAll(async () => {
    await prisma.candidateProfile.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.cvImport.deleteMany({});
    await prisma.applicationEvent.deleteMany({});
    await prisma.application.deleteMany({});
    await prisma.applicationMaterial.deleteMany({});
    await prisma.materialVersion.deleteMany({});
    await prisma.jobMatchDimension.deleteMany({});
    await prisma.jobMatch.deleteMany({});
    await prisma.jobRequirement.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.sourceHealth.deleteMany({});
    await prisma.evidenceRecord.deleteMany({});
    await prisma.experienceEntry.deleteMany({});
    await prisma.skill.deleteMany({});

    const profile = await prisma.candidateProfile.create({
      data: {
        firstName: 'Alex',
        lastName: 'Routes',
        title: 'Senior Backend Engineer',
        targetRoles: ['Senior Backend Engineer'],
      },
    });
    profileId = profile.id;

    const job = await prisma.job.create({
      data: {
        sourceName: 'integration-routes',
        sourceKind: 'Fixture',
        fingerprint: 'routes-aaaaaaaa',
        url: 'https://apply.example/jobs/routesco',
        normalizedUrl: 'https://apply.example/jobs/routesco',
        title: 'Senior Backend Engineer',
        company: COMPANY,
        location: 'Berlin',
        remote: true,
        description: 'Event-driven backend role.',
        salaryMin: 95000,
        salaryMax: 120000,
        salaryCurrency: 'EUR',
        postedAt: new Date('2026-07-01T00:00:00Z'),
        status: 'Active',
        requirements: {
          create: [
            { kind: 'Required', category: 'Skill', key: 'typescript', name: 'TypeScript', minYears: 4 },
            { kind: 'Preferred', category: 'Skill', key: 'redis', name: 'Redis' },
          ],
        },
      },
    });
    jobId = job.id;

    const match = await prisma.jobMatch.create({
      data: {
        jobId,
        jobTitle: job.title,
        company: COMPANY,
        totalScore: 0.92,
        eligible: true,
        confidence: 0.9,
        dimensions: {
          create: [
            { key: 'tech', weight: 30, score: 0.9, applicable: true, status: 'matched', detail: 'Strong overlap' },
            { key: 'salary', weight: 5, score: 0.8, applicable: true, status: 'matched', detail: 'In range' },
          ],
        },
      },
    });

    const transitionJob = await prisma.job.create({
      data: {
        sourceName: 'integration-routes',
        sourceKind: 'Fixture',
        fingerprint: 'routes-bbbbbbbb',
        url: 'https://apply.example/jobs/transitco',
        normalizedUrl: 'https://apply.example/jobs/transitco',
        title: 'Platform Engineer',
        company: 'TransitCo',
        remote: true,
        description: 'Platform role.',
        status: 'Active',
      },
    });
    transitionJobId = transitionJob.id;

    await prisma.sourceHealth.create({
      data: { sourceName: 'integration-routes', healthy: true, consecutiveFailures: 0, lastCheckedAt: new Date(), lastSuccessAt: new Date() },
    });

    await prisma.evidenceRecord.create({
      data: {
        profileId,
        source: 'UserProvided',
        summary: 'Reduced checkout p99 latency',
        rawText: 'Dashboard evidence',
        claims: ['Reduced checkout p99 latency by 40%'],
      },
    });

    await prisma.applicationMaterial.create({
      data: {
        profileId,
        kind: 'Cv',
        status: 'Ready',
        versions: {
          create: { version: 1, content: 'Tailored CV content', promptId: 'documents.cv', promptVersion: 1 },
        },
      },
    });

    const service = new ApplicationService();
    applicationId = (await service.createApplication({ profileId, jobId, url: 'https://apply.example/jobs/routesco', mode: 'review', sourceName: 'integration-routes' })).id;
    await service.transition(applicationId, 'InProgress');

    transitionApplicationId = (await service.createApplication({ profileId, jobId: transitionJobId, url: 'https://apply.example/jobs/transitco', mode: 'review' })).id;

    void match;
  });

  afterAll(async () => {
    await prisma.candidateProfile.deleteMany({});
    await prisma.$disconnect();
  });

  it('GET /dashboard returns real counts and slices', async () => {
    const response = await app().inject({ method: 'GET', url: '/dashboard' });
    const body = response.json();
    expect(response.statusCode).toBe(200);
    expect(body.counts.jobs).toBeGreaterThanOrEqual(1);
    expect(body.counts.activeJobs).toBeGreaterThanOrEqual(1);
    expect(body.counts.matchesEligible).toBeGreaterThanOrEqual(1);
    expect(body.counts.materials).toBeGreaterThanOrEqual(1);
    expect(body.counts.sourcesHealthy).toBeGreaterThanOrEqual(1);
    expect(body.counts.applicationsByStatus.InProgress).toBeGreaterThanOrEqual(1);
    expect(body.topMatches[0].company).toBe(COMPANY);
    expect(body.recentApplications.length).toBeGreaterThanOrEqual(1);
    expect(body.automation.inQueue).toBeGreaterThanOrEqual(1);
  });

  it('GET /jobs lists with status + search + pagination', async () => {
    const appInstance = app();
    const response = await appInstance.inject({
      method: 'GET',
      url: `/jobs?status=Active&search=${COMPANY}&sort=-totalScore&page=1&limit=5`,
    });
    const body = response.json();
    expect(response.statusCode).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items[0].company).toBe(COMPANY);
    expect(typeof body.items[0].requirementsCount).toBe('number');
    expect(body.page).toBe(1);
    expect(body.hasMore).toBe(false);
  });

  it('GET /jobs/:id returns requirements, match dimensions and 404 for unknown ids', async () => {
    const appInstance = app();
    const ok = await appInstance.inject({ method: 'GET', url: `/jobs/${jobId}` });
    expect(ok.statusCode).toBe(200);
    const body = ok.json();
    expect(body.match.totalScore).toBe(0.92);
    expect(body.matchDimensions.map((d: { key: string }) => d.key)).toEqual(['tech', 'salary']);
    expect(body.requirements.length).toBe(2);
    expect(body.applicationsCount).toBeGreaterThanOrEqual(1);

    const missing = await appInstance.inject({ method: 'GET', url: `/jobs/${randomUUID()}` });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');
  });

  it('GET /matches filters by minScore and search', async () => {
    const appInstance = app();
    const all = await appInstance.inject({ method: 'GET', url: '/matches?sort=-totalScore' });
    expect(all.statusCode).toBe(200);
    expect(all.json().items.length).toBeGreaterThanOrEqual(1);
    expect(all.json().items[0].dimensions.length).toBe(2);

    const filtered = await appInstance.inject({ method: 'GET', url: `/matches?minScore=0.95&search=${COMPANY}` });
    expect(filtered.json().items.length).toBe(0);

    const hit = await appInstance.inject({ method: 'GET', url: `/matches?search=${COMPANY}` });
    expect(hit.json().items.length).toBe(1);
  });

  it('GET /candidate returns profile and stats', async () => {
    const response = await app().inject({ method: 'GET', url: '/candidate' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.profile.title).toBe('Senior Backend Engineer');
    expect(body.stats.skillsCount).toBe(0);
    expect(body.stats.experienceEntries).toBe(0);
    expect(body.stats.matchesEligible).toBeGreaterThanOrEqual(1);
    expect(body.stats.applicationsActive).toBeGreaterThanOrEqual(1);
  });

  it('GET /candidate/evidence lists stored evidence', async () => {
    const response = await app().inject({ method: 'GET', url: '/candidate/evidence' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(1);
    expect(body.items[0].summary).toBe('Reduced checkout p99 latency');
  });

  it('GET /candidate/materials lists materials with latest version', async () => {
    const response = await app().inject({ method: 'GET', url: '/candidate/materials' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(1);
    expect(body.items[0].latestVersion.content).toBe('Tailored CV content');
    expect(body.items[0].kind).toBe('Cv');
  });

  it('GET /applications lists with status filter and job summary', async () => {
    const appInstance = app();
    const response = await appInstance.inject({ method: 'GET', url: '/applications?status=InProgress' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
    const row = body.items.find((item: { id: string }) => item.id === applicationId);
    expect(row.job.company).toBe(COMPANY);

    const byCompany = await appInstance.inject({ method: 'GET', url: `/applications?search=${COMPANY}` });
    expect(byCompany.json().items.some((item: { id: string }) => item.id === applicationId)).toBe(true);
  });

  it('GET /applications/:id returns the event trail, 404 for unknown ids', async () => {
    const appInstance = app();
    const ok = await appInstance.inject({ method: 'GET', url: `/applications/${applicationId}` });
    expect(ok.statusCode).toBe(200);
    const body = ok.json();
    expect(body.events.map((e: { type: string }) => e.type)).toEqual(['application.preparing', 'application.in_progress']);
    expect(body.job.company).toBe(COMPANY);

    const missing = await appInstance.inject({ method: 'GET', url: `/applications/${randomUUID()}` });
    expect(missing.statusCode).toBe(404);
  });

  it('PATCH /applications/:id/status advances, then rejects illegal jumps', async () => {
    const appInstance = app();

    const advance = await appInstance.inject({
      method: 'PATCH',
      url: `/applications/${transitionApplicationId}/status`,
      payload: { to: 'InProgress' },
    });
    expect(advance.statusCode).toBe(200);
    expect(advance.json().application.status).toBe('InProgress');

    const submit = await appInstance.inject({
      method: 'PATCH',
      url: `/applications/${transitionApplicationId}/status`,
      payload: { to: 'Submitted' },
    });
    expect(submit.statusCode).toBe(200);
    expect(submit.json().application.status).toBe('Submitted');
    expect(typeof submit.json().application.submittedAt).toBe('string');

    const illegal = await appInstance.inject({
      method: 'PATCH',
      url: `/applications/${transitionApplicationId}/status`,
      payload: { to: 'Prepared' },
    });
    expect(illegal.statusCode).toBe(409);
    expect(illegal.json().error.code).toBe('CONFLICT');

    const invalid = await appInstance.inject({
      method: 'PATCH',
      url: `/applications/${transitionApplicationId}/status`,
      payload: { to: 'Sideways' },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe('VALIDATION_ERROR');

    const missing = await appInstance.inject({
      method: 'PATCH',
      url: `/applications/${transitionApplicationId}/status`,
      payload: {},
    });
    expect(missing.statusCode).toBe(400);
  });

  it('GET /sources returns the source health summary', async () => {
    const response = await app().inject({ method: 'GET', url: '/sources' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const source = body.items.find((item: { sourceName: string }) => item.sourceName === 'integration-routes');
    expect(source.healthy).toBe(true);
    expect(source.jobsCount).toBeGreaterThanOrEqual(1);
  });

  it('GET /automation reports pipeline state', async () => {
    const response = await app().inject({ method: 'GET', url: '/automation' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.pipeline.reviewMode).toBe(true);
    expect(body.pipeline.inQueue).toBeGreaterThanOrEqual(1);
    expect(body.pipeline.sourcesHealthy).toBeGreaterThanOrEqual(1);
    expect(body.profilePresent).toBe(true);
  });

  it('GET /settings is read-only and safe', async () => {
    const response = await app().inject({ method: 'GET', url: '/settings' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.mode).toBe('review');
    expect(typeof body.environment.apiPort).toBe('number');
    expect(typeof body.environment.nodeEnv).toBe('string');
  });

  it('GET /audit lists the application.created trail and filters', async () => {
    const appInstance = app();
    const response = await appInstance.inject({ method: 'GET', url: `/audit?entityType=application&action=application.created` });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const row = body.items.find((item: { entityId: string }) => item.entityId === applicationId);
    expect(row.action).toBe('application.created');
    expect(row.entityType).toBe('application');

    const page = await appInstance.inject({ method: 'GET', url: '/audit?page=1&limit=10' });
    expect(page.json().items.length).toBeGreaterThanOrEqual(1);
    expect(page.json().hasMore).toBe(false);
  });
});