import { MockLLMProvider } from '@jobs-app/ai/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobService } from './job-service.js';
import type { JobRepository } from './repository.js';
import { registerJobSource } from './sources/registry.js';
import { createFixtureJobSource } from './sources/fixture/FixtureJobSource.js';
import type { Job, JobRequirementInput } from './types.js';

const SERVICE_NAME = 'svc-test';

const JOBS: Job[] = [
  {
    sourceName: SERVICE_NAME,
    url: 'https://svc.example/jobs/1',
    title: 'Backend Engineer',
    company: 'Acme',
    description: 'Remote. Requirements: 3+ years Go, PostgreSQL.',
    remote: true,
  },
  {
    sourceName: SERVICE_NAME,
    url: 'https://svc.example/jobs/2',
    title: 'Frontend Engineer',
    company: 'Globex',
    description: 'React and TypeScript.',
    remote: false,
  },
];

type UpsertResult = Awaited<ReturnType<JobRepository['upsertJob']>>;
type HealthResult = Awaited<ReturnType<JobRepository['recordSourceHealth']>>;

function stubRepository(overrides: Partial<JobRepository> = {}) {
  const repo: Partial<JobRepository> = {
    upsertJob: vi.fn(async (_job: unknown, _now?: Date): Promise<UpsertResult> => ({
      job: { id: 'job-1' } as UpsertResult['job'],
      created: true,
    })),
    replaceRequirements: vi.fn(async () => 1),
    recordSourceHealth: vi.fn(async (): Promise<HealthResult> => ({}) as HealthResult),
    listJobs: vi.fn(async () => []),
    listSourceHealth: vi.fn(async () => []),
    getRequirements: vi.fn(async () => []),
    ...overrides,
  };
  return repo as unknown as JobRepository;
}

beforeEach(() => {
  registerJobSource(SERVICE_NAME, () => createFixtureJobSource({ name: SERVICE_NAME, jobs: JOBS }));
});

describe('JobService.discover', () => {
  it('fetches, normalizes, upserts, extracts requirements and records health', async () => {
    const repo = stubRepository();
    const service = new JobService({ repository: repo });

    const summary = await service.discover({ sourceName: SERVICE_NAME });

    expect(summary.fetched).toBe(2);
    expect(summary.rejected).toBe(0);
    expect(summary.created).toBe(2);
    expect(summary.healthy).toBe(true);
    expect(repo.upsertJob).toHaveBeenCalledTimes(2);
    expect(repo.recordSourceHealth).toHaveBeenCalledWith(
      expect.objectContaining({ sourceName: SERVICE_NAME, healthy: true }),
      expect.any(Date),
    );
    expect(repo.replaceRequirements).toHaveBeenCalledTimes(2);
    expect(summary.requirementCount).toBeGreaterThan(0);
  });

  it('counts re-discovered listings as updated, not duplicated', async () => {
    const repo = stubRepository({
      upsertJob: vi.fn(async (): Promise<UpsertResult> => ({ job: { id: 'job-1' } as UpsertResult['job'], created: false })),
    });
    const service = new JobService({ repository: repo });

    const summary = await service.discover({ sourceName: SERVICE_NAME });
    expect(summary.created).toBe(0);
    expect(summary.updated).toBeGreaterThan(0);
  });

  it('skips malformed listings and records the rejection count', async () => {
    const repo = stubRepository();
    const service = new JobService({ repository: repo });
    registerJobSource(SERVICE_NAME, () =>
      createFixtureJobSource({
        name: SERVICE_NAME,
        jobs: [...JOBS, { sourceName: SERVICE_NAME, url: 'https://svc.example/jobs/3', company: 'X' }],
      }),
    );

    const summary = await service.discover({ sourceName: SERVICE_NAME });
    expect(summary.fetched).toBe(3);
    expect(summary.rejected).toBe(1);
    expect(summary.healthy).toBe(true);
  });

  it('records unhealthy and reports instead of throwing when a source fails', async () => {
    const repo = stubRepository();
    const service = new JobService({ repository: repo });
    registerJobSource(SERVICE_NAME, () => ({
      name: SERVICE_NAME,
      kind: 'Api' as const,
      search: async () => {
        throw new Error('ran out of quota');
      },
      getJob: async () => {
        throw new Error('nope');
      },
      healthCheck: async () => true,
    }));

    const summary = await service.discover({ sourceName: SERVICE_NAME });
    expect(summary.healthy).toBe(false);
    expect(summary.error).toContain('quota');
    expect(repo.recordSourceHealth).toHaveBeenCalledWith(
      expect.objectContaining({ sourceName: SERVICE_NAME, healthy: false, error: 'ran out of quota' }),
      expect.any(Date),
    );
  });
});

describe('JobService AI assist', () => {
  it('requests AI extraction when enabled', async () => {
    const provider = new MockLLMProvider({
      structured: {
        requirements: [{ kind: 'Required', category: 'Skill', name: 'Kubernetes' }],
      },
    });
    const repo = stubRepository();
    const service = new JobService({ repository: repo, ai: { provider, model: 'small' } });

    const summary = await service.discover({ sourceName: SERVICE_NAME, useAI: true });

    expect(provider.calls).toHaveLength(2);
    expect(provider.calls.every((call) => call.method === 'structured')).toBe(true);
    const seesAi = vi
      .mocked(repo.replaceRequirements)
      .mock.calls.some(([, requirements]) =>
        (requirements as JobRequirementInput[]).some((r) => r.source === 'AI'),
      );
    expect(seesAi).toBe(true);
    expect(summary.requirementCount).toBeGreaterThan(0);
  });

  it('ignores the AI option when no provider is configured', async () => {
    const repo = stubRepository();
    const service = new JobService({ repository: repo });

    await service.discover({ sourceName: SERVICE_NAME, useAI: true });
    const seesAi = vi
      .mocked(repo.replaceRequirements)
      .mock.calls.some(([, requirements]) =>
        (requirements as JobRequirementInput[]).some((r) => r.source === 'AI'),
      );
    expect(seesAi).toBe(false);
  });
});