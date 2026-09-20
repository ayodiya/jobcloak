import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@jobs-app/database';
import { JobRepository } from '@jobs-app/jobs';
import type { NormalizedJob } from '@jobs-app/jobs';
import { ConflictError, ValidationError } from '@jobs-app/shared';
import { ApplicationEventSink, type SessionEventInput } from './src/event-sink.js';
import { ApplicationRepository } from './src/repository.js';
import { ApplicationService } from './src/service.js';

const JOB_REPO = new JobRepository();

function jobData(company: string, title: string, fingerprint: string): NormalizedJob {
  return {
    sourceName: 'integration-applications',
    fingerprint,
    url: `https://apply.example/jobs/${company.toLowerCase()}`,
    normalizedUrl: `https://apply.example/jobs/${company.toLowerCase()}`,
    title,
    company,
    description: `Event-driven backend role at ${company}. ` + 'x'.repeat(400),
    remote: true,
    location: 'Berlin',
  };
}

describe('applications (integration)', () => {
  let profileId: string;
  let jobAcme: string;
  let jobGlobex: string;
  let jobInitech: string;
  let jobUmbrella: string;
  let jobVandelay: string;

  beforeAll(async () => {
    await prisma.applicationEvent.deleteMany({});
    await prisma.application.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.jobMatchDimension.deleteMany({});
    await prisma.jobMatch.deleteMany({});
    await prisma.jobRequirement.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.sourceHealth.deleteMany({});
    await prisma.experienceEntry.deleteMany({});
    await prisma.skill.deleteMany({});
    await prisma.candidateProfile.deleteMany({});

    const profile = await prisma.candidateProfile.create({
      data: { firstName: 'Alex', lastName: 'Rivera', title: 'Senior Backend Engineer' },
    });
    profileId = profile.id;

    jobAcme = (await JOB_REPO.upsertJob(jobData('Acme', 'Senior Backend Engineer', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), new Date('2026-08-01T00:00:00Z'))).job.id;
    jobGlobex = (await JOB_REPO.upsertJob(jobData('Globex', 'Staff Engineer', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'), new Date('2026-08-01T00:00:00Z'))).job.id;
    jobInitech = (await JOB_REPO.upsertJob(jobData('Initech', 'Platform Engineer', 'cccccccccccccccccccccccccccccccccccccccc'), new Date('2026-08-01T00:00:00Z'))).job.id;
    jobUmbrella = (await JOB_REPO.upsertJob(jobData('Umbrella', 'DevOps Engineer', 'dddddddddddddddddddddddddddddddddddddddd'), new Date('2026-08-01T00:00:00Z'))).job.id;
    jobVandelay = (await JOB_REPO.upsertJob(jobData('Vandelay', 'Backend Engineer', 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'), new Date('2026-08-01T00:00:00Z'))).job.id;
  });

  afterAll(async () => {
    await prisma.applicationEvent.deleteMany({});
    await prisma.application.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.jobRequirement.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.sourceHealth.deleteMany({});
    await prisma.experienceEntry.deleteMany({});
    await prisma.skill.deleteMany({});
    await prisma.candidateProfile.deleteMany({});
    await prisma.$disconnect();
  });

  it('creates an application with its initial event and audit mirror', async () => {
    const service = new ApplicationService();
    const created = await service.createApplication({
      profileId,
      jobId: jobAcme,
      url: `https://apply.example/jobs/acme`,
      sourceName: 'integration-applications',
      mode: 'review',
    });

    expect(created.id).toBeDefined();
    expect(created.status).toBe('Prepared');

    const stored = await prisma.application.findUnique({
      where: { id: created.id },
      include: { events: { orderBy: { at: 'asc' } } },
    });
    expect(stored?.events.map((event) => event.type)).toEqual(['application.preparing']);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'application', entityId: created.id },
    });
    expect(audit?.action).toBe('application.created');
  });

  it('is idempotent — a second create for the same profile+job returns the same row', async () => {
    const service = new ApplicationService();
    const application = await service.createApplication({
      profileId,
      jobId: jobAcme,
      url: `https://apply.example/jobs/acme`,
      submissionKey: 'idempotency-key-1',
    });

    const applicationCount = await prisma.application.count({ where: { profileId, jobId: jobAcme } });
    expect(applicationCount).toBe(1);

    const found = await prisma.application.findUnique({ where: { submissionKey: 'idempotency-key-1' } });
    expect(found?.id).toBe(application.id);
  });

  it('walks the happy path and records timestamps', async () => {
    const service = new ApplicationService();
    const created = await service.createApplication({
      profileId,
      jobId: jobGlobex,
      url: `https://apply.example/jobs/globex`,
      mode: 'review',
    });

    const inProgress = await service.transition(created.id, 'InProgress');
    expect(inProgress.status).toBe('InProgress');

    const submitted = await service.transition(created.id, 'Submitted');
    expect(submitted.status).toBe('Submitted');
    expect(submitted.submittedAt).toBeInstanceOf(Date);

    const verified = await service.transition(created.id, 'Verified');
    expect(verified.status).toBe('Verified');
    expect(verified.verifiedAt).toBeInstanceOf(Date);

    const types = verified.events.map((event) => event.type);
    expect(types.filter((type) => type.startsWith('application.'))).toEqual([
      'application.preparing',
      'application.in_progress',
      'application.submitted',
      'application.verified',
    ]);
  });

  it('rejects illegal state jumps for a fresh application', async () => {
    const service = new ApplicationService();
    const created = await service.createApplication({
      profileId,
      jobId: jobInitech,
      url: `https://apply.example/jobs/initech`,
    });

    await expect(service.transition(created.id, 'Submitted')).rejects.toBeInstanceOf(ConflictError);
    await expect(service.transition(created.id, 'Rejected')).rejects.toBeInstanceOf(ConflictError);
    await expect(service.transition(created.id, 'Backwards' as never)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('records metadata-only payload events in chronological order', async () => {
    const service = new ApplicationService();
    const created = await service.createApplication({
      profileId,
      jobId: jobUmbrella,
      url: `https://apply.example/jobs/umbrella`,
    });
    const at = new Date('2026-08-02T10:00:00Z');

    await service.recordEvent(created.id, { type: 'session.opened', stage: 'opening', payload: { url: `https://apply.example/jobs/umbrella` }, at });
    await service.recordEvent(created.id, { type: 'form.mapped', stage: 'mapping', payload: { count: 7 }, at: new Date('2026-08-02T10:00:01Z') });

    const stored = await service.getApplication(created.id);
    const trail = stored.events.filter((event) => event.type.startsWith('session.') || event.type.startsWith('form.'));
    expect(trail.map((event) => event.type)).toEqual(['session.opened', 'form.mapped']);
    expect(trail[0]?.payload).toEqual({ url: `https://apply.example/jobs/umbrella` });
  });

  it('lists applications with job summary and filters by status and company', async () => {
    const service = new ApplicationService();
    const created = await service.createApplication({
      profileId,
      jobId: jobUmbrella,
      url: `https://apply.example/jobs/umbrella`,
    });
    await service.transition(created.id, 'InProgress');

    const active = await service.listApplications({ status: 'InProgress' });
    expect(active.total).toBeGreaterThanOrEqual(1);
    const row = active.rows.find((item) => item.id === created.id);
    expect(row?.job.company).toBe('Umbrella');
    expect(row?.job.title).toBe('DevOps Engineer');

    const filtered = await service.listApplications({ company: 'umbrella' });
    expect(filtered.rows.some((item) => item.id === created.id)).toBe(true);

    const counts = await service.countByStatus();
    expect(counts.InProgress).toBeGreaterThanOrEqual(1);
    expect(counts.Prepared).toBeGreaterThanOrEqual(1);
  });

  it('persists browser session events through the event sink', async () => {
    const service = new ApplicationService();
    const created = await service.createApplication({
      profileId,
      jobId: jobGlobex,
      url: `https://apply.example/jobs/globex`,
    });

    const sink = new ApplicationEventSink(created.id, service.repo);
    const sessionEvents: SessionEventInput[] = [
      { type: 'session.opened', at: 1000, stage: 'opening' },
      { type: 'form.mapped', at: 2000, stage: 'mapping', payload: { count: 7 } },
      { type: 'field.mapped', at: 2100, stage: 'mapping', payload: { key: 'k1', confidence: 'high', required: true } },
      { type: 'submission.blocked', at: 3000, stage: 'waiting-approval', payload: { reason: 'security gate' } },
    ];

    for (const event of sessionEvents) await sink.emit(event);

    const stored = await service.getApplication(created.id);
    const trail = stored.events.filter(
      (event) => event.type === 'session.opened' || event.type.startsWith('form.') || event.type.startsWith('field.mapped') || event.type === 'submission.blocked',
    );
    expect(trail.map((event) => event.type)).toEqual([
      'session.opened',
      'form.mapped',
      'field.mapped',
      'submission.blocked',
    ]);
    expect(trail[0]?.stage).toBe('opening');
    expect(trail[3]?.payload).toEqual({ reason: 'security gate' });
    expect(trail[0]?.at.toISOString()).toBe(new Date(1000).toISOString());
  });

  it('sanitizes display text before persistence', async () => {
    const repository = new ApplicationRepository();
    const created = await repository.createApplication({
      profileId,
      jobId: jobVandelay,
      url: 'https://apply.example/jobs/<script>alert(1)</script>',
      mode: 'review',
      sourceName: 'evil"source"<b>',
    });
    expect(created.url).toBe('https://apply.example/jobs/scriptalert(1)/script');
    expect(created.sourceName).toBe('evilsourceb');
  });
});