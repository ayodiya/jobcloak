import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDefaultModelRouter } from '@jobs-app/ai';
import { MockLLMProvider } from '@jobs-app/ai/testing';
import { prisma } from '@jobs-app/database';
import { JobRepository } from '@jobs-app/jobs';
import type { NormalizedJob } from '@jobs-app/jobs';
import { ApplicationGenerator } from './src/generator.js';
import { snapshotDigest } from './src/evidence-snapshot.js';
import { MaterialRepository } from './src/repository.js';

const EVIDENCE_TEXT =
  'Alex Rivera is a senior backend engineer who led the migration of the payments platform to TypeScript and PostgreSQL at Acme Corp in Berlin.';

const JOB_DATA: NormalizedJob = {
  sourceName: 'integration-documents',
  fingerprint: 'b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0',
  url: 'https://docs.example/jobs/1',
  normalizedUrl: 'https://docs.example/jobs/1',
  title: 'Staff Engineer',
  company: 'Acme',
  description: 'Payments platform in Berlin. ' + 'x'.repeat(400),
  remote: false,
  location: 'Berlin',
  seniority: 'Staff',
  salaryMin: 100000,
  salaryMax: 130000,
  salaryCurrency: 'EUR',
};

const REQUIREMENTS = [
  { kind: 'Required' as const, category: 'Skill' as const, key: 'typescript', name: 'TypeScript', source: 'Deterministic' as const },
];

describe('documents (integration)', () => {
  let profileId: string;
  let jobId: string;
  let evidenceId: string;

  beforeAll(async () => {
    await prisma.materialVersion.deleteMany({});
    await prisma.applicationMaterial.deleteMany({});
    await prisma.evidenceSnapshot.deleteMany({});
    await prisma.jobRequirement.deleteMany({});
    await prisma.jobMatchDimension.deleteMany({});
    await prisma.jobMatch.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.sourceHealth.deleteMany({});
    await prisma.skill.deleteMany({});
    await prisma.experienceEntry.deleteMany({});
    await prisma.evidenceRecord.deleteMany({});
    await prisma.candidateProfile.deleteMany({});

    const profile = await prisma.candidateProfile.create({
      data: {
        firstName: 'Alex',
        lastName: 'Rivera',
        title: 'Senior Backend Engineer',
        targetRoles: ['Senior Backend Engineer'],
        preferredLocations: ['Berlin'],
        remotePreferred: true,
        expectedSalaryMin: 90000,
        expectedSalaryMax: 115000,
        currency: 'EUR',
        languages: ['English', 'Spanish'],
      },
    });
    profileId = profile.id;

    await prisma.skill.createMany({
      data: [
        { profileId, name: 'TypeScript', key: 'typescript', level: 'Advanced', years: 5, lastUsedYear: 2026 },
        { profileId, name: 'PostgreSQL', key: 'postgresql', level: 'Advanced', years: 4, lastUsedYear: 2026 },
      ],
    });

    await prisma.experienceEntry.create({
      data: {
        profileId,
        organization: 'Acme Corp',
        title: 'Senior Backend Engineer',
        startDate: new Date('2021-01-01'),
        endDate: null,
        current: true,
      },
    });

    const evidence = await prisma.evidenceRecord.create({
      data: { profileId, source: 'UserProvided', rawText: EVIDENCE_TEXT },
    });
    evidenceId = evidence.id;

    const { job } = await new JobRepository().upsertJob(JOB_DATA, new Date('2026-01-15T00:00:00Z'));
    jobId = job.id;
    await new JobRepository().replaceRequirements(jobId, REQUIREMENTS);
  });

  afterAll(async () => {
    await prisma.materialVersion.deleteMany({});
    await prisma.applicationMaterial.deleteMany({});
    await prisma.evidenceSnapshot.deleteMany({});
    await prisma.jobRequirement.deleteMany({});
    await prisma.jobMatchDimension.deleteMany({});
    await prisma.jobMatch.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.sourceHealth.deleteMany({});
    await prisma.skill.deleteMany({});
    await prisma.experienceEntry.deleteMany({});
    await prisma.evidenceRecord.deleteMany({});
    await prisma.candidateProfile.deleteMany({});
    await prisma.$disconnect();
  });

  it('persists a cover letter material pinned to its prompt version and evidence snapshot', async () => {
    const mock = new MockLLMProvider({
      health: true,
      structured: {
        opening: 'I am a senior backend engineer applying to the Staff Engineer role at Acme.',
        body: ['I led the migration of the payments platform to TypeScript and PostgreSQL.'],
        closing: 'I led the migration of the payments platform to TypeScript and PostgreSQL.',
      },
    });
    const gen = new ApplicationGenerator({
      ai: createDefaultModelRouter({ providers: [mock], healthGating: false }),
      maxRegenerations: 0,
      loadJob: async () => {
        const jobs = new JobRepository();
        const job = (await jobs.findById(jobId))!;
        const requirements = await jobs.getRequirements(jobId);
        return {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          remote: job.remote,
          description: job.description,
          seniority: job.seniority,
          requirements: requirements.map((r) => ({
            kind: r.kind,
            category: r.category,
            name: r.name,
            minYears: r.minYears,
            source: r.source,
          })),
        };
      },
    });

    const outcome = await gen.generateCoverLetter({ jobId });
    expect(outcome.status).toBe('Ready');

    const material = await prisma.applicationMaterial.findFirst({
      where: { profileId, kind: 'CoverLetter', jobId },
    });
    expect(material).not.toBeNull();
    expect(material?.version).toBe(1);

    const version = await prisma.materialVersion.findUnique({
      where: { materialId_version: { materialId: material!.id, version: 1 } },
      include: { snapshot: true },
    });
    expect(version).not.toBeNull();
    expect(version?.promptId).toBe('documents.cover-letter');
    expect(version?.promptVersion).toBe(1);
    expect(version?.snapshotId).not.toBeNull();
    expect(version?.snapshot?.hash).toBe(snapshotDigest([{ id: evidenceId, rawText: EVIDENCE_TEXT }]));
    expect((version?.snapshot?.evidenceIds as string[]).sort()).toEqual([evidenceId]);
    expect(version?.factuality).toMatchObject({ passed: true, totalClaims: 3 });
  });

  it('keeps one material per question and bumps its version across regenerations', async () => {
    const mock = new MockLLMProvider({
      health: true,
      structured: { answer: 'I led the migration of the payments platform to TypeScript and PostgreSQL.' },
    });
    const gen = new ApplicationGenerator({
      ai: createDefaultModelRouter({ providers: [mock], healthGating: false }),
      maxRegenerations: 0,
    });

    const question = 'Why are you excited about backend engineering?';
    const first = await gen.generateAnswer({ jobId, question });
    const second = await gen.generateAnswer({ jobId, question });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    const materials = await prisma.applicationMaterial.findMany({
      where: { profileId, kind: 'Answer', jobId },
    });
    expect(materials).toHaveLength(1);

    const versions = await prisma.materialVersion.count({
      where: { materialId: materials[0]!.id },
    });
    expect(versions).toBe(2);
  });

  it('flags generated materials with unsupported claims as Review', async () => {
    const mock = new MockLLMProvider({
      health: true,
      structured: { answer: 'I invented a quantum rocket engine in my garage last Tuesday.' },
    });
    const gen = new ApplicationGenerator({
      ai: createDefaultModelRouter({ providers: [mock], healthGating: false }),
      maxRegenerations: 0,
    });

    const outcome = await gen.generateAnswer({ jobId, question: 'Describe your most impressive project.' });
    expect(outcome.status).toBe('Review');

    const material = await prisma.applicationMaterial.findFirst({
      where: { profileId, kind: 'Answer', jobId },
      orderBy: { updatedAt: 'desc' },
    });
    expect(material?.status).toBe('Review');
  });

  it('lists materials with their latest version', async () => {
    const repo = new MaterialRepository();
    const rows = await repo.listMaterials(profileId);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.material.profileId).toBe(profileId);
      expect(row.latestVersion).not.toBeNull();
      expect(row.latestVersion?.content.length).toBeGreaterThan(0);
    }
  });
});