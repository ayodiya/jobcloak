import { describe, expect, it, vi } from 'vitest';
import type { JobRepository } from '@jobs-app/jobs';
import { MatchingService } from './matching-service.js';
import type { MatchRepository, MatchWithDimensions } from './repository.js';
import type { CandidateView, JobMatchView, MatchResult } from './types.js';

const CANDIDATE: CandidateView = {
  id: 'cand-1',
  title: 'Senior Backend Engineer',
  skills: [{ key: 'typescript', name: 'TypeScript', years: 5 }],
  experienceYears: 6,
  backgroundText: 'Senior Backend Engineer',
  preferredLocations: ['Berlin'],
  remotePreferred: true,
};

const JOB: JobMatchView = {
  id: 'job-1',
  title: 'Senior Backend Engineer',
  company: 'Acme',
  remote: true,
  description: 'Payments. ' + 'x'.repeat(400),
  salaryMin: 100000,
  salaryMax: 120000,
  salaryCurrency: 'EUR',
  requirements: [
    { kind: 'Required', category: 'Skill', key: 'typescript', name: 'TypeScript', source: 'Deterministic' },
    { kind: 'Required', category: 'Experience', key: 'backend', name: 'backend', minYears: 4, source: 'Deterministic' },
  ],
};

type UpsertResult = Awaited<ReturnType<MatchRepository['upsertMatch']>>;

function stubRepository(overrides: Partial<MatchRepository> = {}) {
  const repo: Partial<MatchRepository> = {
    findByJobId: vi.fn(async () => ({ id: 'match-1', dimensions: [] }) as unknown as MatchWithDimensions),
    upsertMatch: vi.fn(async (_result: MatchResult): Promise<UpsertResult> => ({ id: 'match-1' }) as UpsertResult),
    getMatch: vi.fn(async () => ({ id: 'match-1', dimensions: [] }) as unknown as MatchWithDimensions),
    listMatches: vi.fn(async () => []),
    countMatches: vi.fn(async () => 0),
    ...overrides,
  };
  return repo as unknown as MatchRepository;
}

describe('MatchingService.matchJob', () => {
  it('scores the candidate against the job and persists the result', async () => {
    const upsert = vi.fn(async (_result: MatchResult): Promise<UpsertResult> => ({ id: 'match-1' }) as UpsertResult);
    const repo = stubRepository({ upsertMatch: upsert as MatchRepository['upsertMatch'] });
    const service = new MatchingService({
      repository: repo,
      loadCandidate: async () => CANDIDATE,
      loadJob: async () => JOB,
      now: () => new Date('2026-01-01T00:00:00Z'),
    });

    const outcome = await service.matchJob('job-1');

    expect(outcome.result.jobId).toBe('job-1');
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('throws when the job does not exist', async () => {
    const service = new MatchingService({
      repository: stubRepository(),
      loadCandidate: async () => CANDIDATE,
      loadJob: async () => null,
    });
    await expect(service.matchJob('missing')).rejects.toThrow('Job not found: missing');
  });
});

describe('MatchingService.matchAll', () => {
  it('matches each active job and reports failures without aborting', async () => {
    const upsert = vi.fn(async (_result: MatchResult): Promise<UpsertResult> => ({ id: 'match-1' }) as UpsertResult);
    const repo = stubRepository({ upsertMatch: upsert as MatchRepository['upsertMatch'] });
    const service = new MatchingService({
      repository: repo,
      jobs: { listJobs: vi.fn(async () => [{ id: 'job-1' }, { id: 'job-broken' }]) } as unknown as JobRepository,
      loadCandidate: async () => CANDIDATE,
      loadJob: async (jobId) => (jobId === 'job-broken' ? null : { ...JOB, id: jobId }),
    });

    const summary = await service.matchAll();

    expect(summary.matchedAt).toBe(1);
    expect(summary.failed).toHaveLength(1);
    expect(upsert).toHaveBeenCalledOnce();
  });
});

describe('MatchingService list helpers', () => {
  const repo = stubRepository();

  it('forwards list and count to the repository', async () => {
    const service = new MatchingService({ repository: repo });
    await service.listMatches({ eligible: true });
    await service.countMatches({ company: 'Acme' });
    expect(repo.listMatches).toHaveBeenCalledWith({ eligible: true });
    expect(repo.countMatches).toHaveBeenCalledWith({ company: 'Acme' });
  });

  it('throws a NotFoundError for an unmatched job', async () => {
    const emptyRepo = stubRepository({
      getMatch: vi.fn(async () => {
        throw new Error('No match recorded for job: job-9');
      }),
    });
    const service = new MatchingService({ repository: emptyRepo });
    await expect(service.getMatch('job-9')).rejects.toThrow('No match recorded for job: job-9');
  });
});