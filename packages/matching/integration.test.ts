import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@jobs-app/database';
import { JobRepository } from '../jobs/src/repository.js';
import type { NormalizedJob } from '../jobs/src/types.js';
import { MatchingService } from './src/matching-service.js';

const JOB_REPO = new JobRepository();

const JOB_DATA: NormalizedJob = {
  sourceName: 'integration-match',
  fingerprint: 'a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9',
  url: 'https://match.example/jobs/1',
  normalizedUrl: 'https://match.example/jobs/1',
  title: 'Senior Backend Engineer',
  company: 'Acme',
  description: 'Payments platform in Berlin. ' + 'x'.repeat(400),
  remote: false,
  location: 'Berlin',
  seniority: 'Senior',
  salaryMin: 95000,
  salaryMax: 120000,
  salaryCurrency: 'EUR',
};

const REQUIREMENTS = [
  { kind: 'Required' as const, category: 'Skill' as const, key: 'typescript', name: 'TypeScript', source: 'Deterministic' as const },
  { kind: 'Required' as const, category: 'Skill' as const, key: 'postgresql', name: 'PostgreSQL', source: 'Deterministic' as const },
  { kind: 'Required' as const, category: 'Experience' as const, key: 'backend', name: 'backend engineering', minYears: 5, source: 'Deterministic' as const },
  { kind: 'Preferred' as const, category: 'Skill' as const, key: 'redis', name: 'Redis', source: 'Deterministic' as const },
];

describe('matching (integration)', () => {
  let jobId: string;

  beforeAll(async () => {
    // Clear in FK-safe order
    await prisma.jobMatchDimension.deleteMany({});
    await prisma.jobMatch.deleteMany({});
    await prisma.jobRequirement.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.sourceHealth.deleteMany({});
    await prisma.skill.deleteMany({});
    await prisma.experienceEntry.deleteMany({});
    await prisma.candidateProfile.deleteMany({});

    // Seed candidate profile
    const profile = await prisma.candidateProfile.create({
      data: {
        firstName: 'Alex',
        lastName: 'Rivera',
        title: 'Senior Backend Engineer',
        targetRoles: ['Senior Backend Engineer', 'Staff Engineer'],
        preferredLocations: ['Berlin', 'Remote (EU)'],
        remotePreferred: true,
        relocationWilling: false,
        expectedSalaryMin: 90000,
        expectedSalaryMax: 115000,
        currency: 'EUR',
        workAuthorization: 'EU Blue Card',
        visaStatus: 'No sponsorship needed',
        languages: ['English', 'Spanish'],
      },
    });

    await prisma.skill.createMany({
      data: [
        { profileId: profile.id, name: 'TypeScript', key: 'typescript', level: 'Advanced', years: 5, lastUsedYear: 2026 },
        { profileId: profile.id, name: 'Node.js', key: 'node', level: 'Advanced', years: 5, lastUsedYear: 2026 },
        { profileId: profile.id, name: 'PostgreSQL', key: 'postgresql', level: 'Advanced', years: 4, lastUsedYear: 2026 },
        { profileId: profile.id, name: 'Redis', key: 'redis', level: 'Intermediate', years: 3, lastUsedYear: 2025 },
        { profileId: profile.id, name: 'Kubernetes', key: 'kubernetes', level: 'Intermediate', years: 2, lastUsedYear: 2026 },
      ],
    });

    await prisma.experienceEntry.create({
      data: {
        profileId: profile.id,
        title: 'Senior Backend Engineer',
        organization: 'Acme Corp',
        startDate: new Date('2021-01-01'),
        endDate: null,
        current: true,
      },
    });

    // Seed job + requirements
    const { job } = await JOB_REPO.upsertJob(JOB_DATA, new Date('2026-01-15T00:00:00Z'));
    jobId = job.id;
    await JOB_REPO.replaceRequirements(jobId, REQUIREMENTS);
  });

  afterAll(async () => {
    await prisma.jobMatchDimension.deleteMany({});
    await prisma.jobMatch.deleteMany({});
    await prisma.jobRequirement.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.sourceHealth.deleteMany({});
    await prisma.skill.deleteMany({});
    await prisma.experienceEntry.deleteMany({});
    await prisma.candidateProfile.deleteMany({});
    await prisma.$disconnect();
  });

  it('scores a seeded candidate against a seeded job and persists the match', async () => {
    const service = new MatchingService();
    const outcome = await service.matchJob(jobId);

    expect(outcome.result.jobId).toBe(jobId);
    expect(outcome.result.totalScore).toBeGreaterThan(0);
    expect(outcome.dimensions.length).toBe(7); // one row per dimension
    expect(outcome.match.id).toBeDefined();
  });

  it('recomputes idempotently — replaces dimensions in place', async () => {
    const service = new MatchingService();
    const first = await service.matchJob(jobId);
    const second = await service.matchJob(jobId);

    expect(second.match.id).toBe(first.match.id);
    expect(second.result.totalScore).toBe(first.result.totalScore);

    const matchCount = await prisma.jobMatch.count({ where: { jobId } });
    expect(matchCount).toBe(1);

    const dimensionCount = await prisma.jobMatchDimension.count({ where: { matchId: first.match.id } });
    expect(dimensionCount).toBe(7);
  });

  it('finds the match via getMatch and listMatches', async () => {
    const service = new MatchingService();
    const stored = await service.getMatch(jobId);

    expect(stored.jobId).toBe(jobId);
    expect(stored.dimensions.length).toBe(7);

    const listed = await service.listMatches({ eligible: true });
    expect(listed.some((match) => match.jobId === jobId)).toBe(true);

    const count = await service.countMatches();
    expect(count).toBe(1);
  });
});