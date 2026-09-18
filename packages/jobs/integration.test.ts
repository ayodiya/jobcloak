import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@jobs-app/database';
import { JobService } from './src/job-service.js';
import { normalizeJob, parseJob } from './src/normalize.js';
import { JobRepository } from './src/repository.js';
import { createFixtureJobSource } from './src/sources/fixture/FixtureJobSource.js';
import { registerJobSource } from './src/sources/registry.js';
import type { Job } from './src/types.js';

const INTEGRATION_SOURCE = 'integration-src';

const FIXTURE: Job[] = [
  {
    sourceName: INTEGRATION_SOURCE,
    url: 'https://integration.example/jobs/1?utm_source=x',
    title: 'Senior Backend Engineer',
    company: 'Integration Inc',
    description:
      'Remote. Requirements:\n- 4+ years of Python\n- PostgreSQL and Docker\nPreferred:\n- Kubernetes',
    location: 'Remote',
  },
  {
    sourceName: INTEGRATION_SOURCE,
    url: 'https://integration.example/jobs/2',
    title: 'Data Analyst',
    company: 'Acme',
    description: 'SQL and pandas. Nice to have: machine learning.',
    location: 'Berlin',
  },
];

registerJobSource(INTEGRATION_SOURCE, () =>
  createFixtureJobSource({ name: INTEGRATION_SOURCE, jobs: FIXTURE }),
);

describe('jobs (integration)', () => {
  const repository = new JobRepository();

  beforeAll(async () => {
    await prisma.jobRequirement.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.sourceHealth.deleteMany({});
  });

  afterAll(async () => {
    await prisma.jobRequirement.deleteMany({});
    await prisma.job.deleteMany({});
    await prisma.sourceHealth.deleteMany({});
    await prisma.$disconnect();
  });

  it('persists a normalized job and re-discovery upserts instead of duplicating', async () => {
    const input = parseJob(FIXTURE[0]);
    const job = normalizeJob(input);
    const first = await repository.upsertJob(job, new Date('2026-01-01T00:00:00Z'));
    const second = await repository.upsertJob(job, new Date('2026-01-02T00:00:00Z'));

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.job.id).toBe(first.job.id);
    expect(second.job.lastSeenAt.getTime()).toBe(new Date('2026-01-02T00:00:00Z').getTime());
    expect(job.fingerprint).toMatch(/^[0-9a-f]{40}$/);
    expect(await repository.countJobs({ sourceName: INTEGRATION_SOURCE })).toBe(1);
  });

  it('replaces requirements atomically without violating the unique constraint', async () => {
    const input = normalizeJob(parseJob(FIXTURE[0]));
    const { job } = await repository.upsertJob(input);

    const requirements = [
      {
        kind: 'Required' as const,
        category: 'Skill' as const,
        key: 'python',
        name: 'Python',
        detail: '4+ years of Python',
        source: 'Deterministic' as const,
      },
      {
        kind: 'Required' as const,
        category: 'Experience' as const,
        key: '4+ years',
        name: '4+ years experience',
        minYears: 4,
        source: 'Deterministic' as const,
      },
    ];
    const count = await repository.replaceRequirements(job.id, requirements);
    expect(count).toBe(2);

    // Replacing with overlapping entries keeps the constraint intact
    await repository.replaceRequirements(job.id, [...requirements, requirements[0]!]);
    const stored = await repository.getRequirements(job.id);
    expect(stored).toHaveLength(2);
    expect(stored.map((r) => r.key).sort()).toEqual(['4+ years', 'python']);
  });

  it('tracks source health streaks', async () => {
    await repository.recordSourceHealth({ sourceName: 'flaky-src', healthy: false, error: 'boom' }, new Date('2026-01-01'));
    await repository.recordSourceHealth({ sourceName: 'flaky-src', healthy: false, error: 'boom 2' }, new Date('2026-01-02'));

    const failing = await prisma.sourceHealth.findUnique({ where: { sourceName: 'flaky-src' } });
    expect(failing?.consecutiveFailures).toBe(2);
    expect(failing?.lastError).toBe('boom 2');

    await repository.recordSourceHealth({ sourceName: 'flaky-src', healthy: true }, new Date('2026-01-03'));
    const recovered = await prisma.sourceHealth.findUnique({ where: { sourceName: 'flaky-src' } });
    expect(recovered?.consecutiveFailures).toBe(0);
    expect(recovered?.lastSuccessAt).not.toBeNull();
  });

  it('runs discovery end-to-end through the service', async () => {
    const service = new JobService({ repository });

    const summary = await service.discover({ sourceName: INTEGRATION_SOURCE });
    expect(summary.fetched).toBe(2);
    expect(summary.rejected).toBe(0);
    expect(summary.healthy).toBe(true);
    expect(summary.created + summary.updated).toBe(2);

    const jobs = await service.listJobs({ sourceName: INTEGRATION_SOURCE });
    expect(jobs).toHaveLength(2);
    expect(jobs.find((j) => j.title === 'Senior Backend Engineer')?.remote).toBe(true);
    expect(jobs.find((j) => j.title === 'Data Analyst')?.remote).toBe(false);

    const dataAnalyst = jobs.find((j) => j.title === 'Data Analyst');
    expect(dataAnalyst?.salaryMin).toBeNull();
    const requirements = dataAnalyst ? await repository.getRequirements(dataAnalyst.id) : [];
    expect(requirements.some((r) => r.key === 'sql' && r.category === 'Skill')).toBe(true);

    const health = await service.listSourceHealth();
    expect(health.find((h) => h.sourceName === INTEGRATION_SOURCE)?.healthy).toBe(true);
  });

  it('filters jobs by company', async () => {
    const jobs = await repository.listJobs({ company: 'acme', limit: 10 });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.company).toBe('Acme');
  });
});