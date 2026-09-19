import { describe, expect, it } from 'vitest';
import { scoreJob } from './scorer.js';
import type { CandidateView, JobMatchView } from './types.js';

const CANDIDATE: CandidateView = {
  id: 'cand-1',
  title: 'Senior Backend Engineer',
  targetRoles: ['Senior Backend Engineer', 'Staff Engineer'],
  preferredLocations: ['Berlin'],
  remotePreferred: true,
  relocationWilling: false,
  expectedSalaryMin: 90000,
  expectedSalaryMax: 115000,
  currency: 'EUR',
  workAuthorization: 'EU Blue Card',
  visaStatus: '',
  skills: [
    { key: 'typescript', name: 'TypeScript', years: 5 },
    { key: 'node', name: 'Node.js', years: 5 },
    { key: 'postgresql', name: 'PostgreSQL', years: 4 },
    { key: 'redis', name: 'Redis', years: 3 },
    { key: 'kubernetes', name: 'Kubernetes', years: 2 },
  ],
  experienceYears: 6,
  backgroundText: 'Senior Backend Engineer at Acme Payments',
};

function makeJob(overrides: Partial<JobMatchView> = {}): JobMatchView {
  return {
    id: 'job-1',
    title: 'Senior Backend Engineer',
    company: 'Acme',
    location: 'Berlin',
    remote: false,
    description: 'Payments platform for merchants. ' + 'x'.repeat(400),
    seniority: 'senior',
    salaryMin: 95000,
    salaryMax: 120000,
    salaryCurrency: 'EUR',
    requirements: [
      { kind: 'Required', category: 'Skill', key: 'typescript', name: 'TypeScript', source: 'Deterministic' },
      { kind: 'Required', category: 'Skill', key: 'postgresql', name: 'PostgreSQL', source: 'Deterministic' },
      { kind: 'Required', category: 'Experience', key: 'backend', name: 'backend engineering', minYears: 5, source: 'Deterministic' },
    ],
    ...overrides,
  };
}

describe('scoreJob dimensions', () => {
  it('scores a strong match high across dimensions', () => {
    const result = scoreJob(CANDIDATE, makeJob());
    expect(result.dimensions.tech.score).toBeCloseTo(1, 2);
    expect(result.dimensions.experience.score).toBeCloseTo(1, 2);
    expect(result.dimensions.seniority.score).toBe(1);
    expect(result.dimensions.role.score).toBe(1);
    expect(result.dimensions.location.score).toBe(1);
    expect(result.totalScore).toBeGreaterThan(0.9);
    expect(result.eligible).toBe(true);
  });

  it('marks tech partial when only preferred skills are missing', () => {
    const job = makeJob({
      requirements: [
        { kind: 'Required', category: 'Skill', key: 'typescript', name: 'TypeScript', source: 'Deterministic' },
        { kind: 'Preferred', category: 'Skill', key: 'kafka', name: 'Kafka', source: 'Deterministic' },
      ],
    });
    const result = scoreJob(CANDIDATE, job);
    expect(result.dimensions.tech.score).toBeCloseTo(1 / 1.5, 2);
    expect(result.dimensions.tech.status).toBe('partial');
  });

  it('excludes tech from the total when the job lists no skills', () => {
    const result = scoreJob(CANDIDATE, makeJob({ requirements: [] }));
    expect(result.dimensions.tech.applicable).toBe(false);
    expect(result.dimensions.tech.status).toBe('not-applicable');
  });

  it('scores experience as a ratio of candidate to required years', () => {
    const job = makeJob({
      requirements: [
        { kind: 'Required', category: 'Experience', key: 'backend', name: 'backend experience', minYears: 12, source: 'Deterministic' },
      ],
    });
    const result = scoreJob(CANDIDATE, job);
    expect(result.dimensions.experience.score).toBeCloseTo(6 / 12, 2);
    expect(result.dimensions.experience.status).toBe('partial');
  });

  it('reports missing level bands for seniority', () => {
    const job = makeJob({ title: 'Principal Backend Engineer', seniority: 'principal' });
    const result = scoreJob(CANDIDATE, job);
    expect(result.dimensions.seniority.score).toBe(0);
    expect(result.dimensions.seniority.status).toBe('missing');
  });

  it('is not applicable when the job has no seniority signal', () => {
    const job = makeJob({ title: 'Backend Engineer', seniority: null });
    const result = scoreJob(CANDIDATE, job);
    expect(result.dimensions.seniority.applicable).toBe(false);
  });

  it('gives full role credit for title overlap', () => {
    const result = scoreJob(CANDIDATE, makeJob({ title: 'Backend Engineer' }));
    expect(result.dimensions.role.score).toBe(1);
  });

  it('accepts remote roles unless the candidate prefers on-site', () => {
    const remote = scoreJob(CANDIDATE, makeJob({ remote: true }));
    expect(remote.dimensions.location.score).toBe(1);

    const onSite = scoreJob({ ...CANDIDATE, remotePreferred: false }, makeJob({ remote: true }));
    expect(onSite.dimensions.location.score).toBe(0);
  });

  it('gives relocation credit for unmatched on-site locations', () => {
    const job = makeJob({ location: 'Munich' });
    const result = scoreJob({ ...CANDIDATE, relocationWilling: true }, job);
    expect(result.dimensions.location.score).toBe(0.6);

    const stuck = scoreJob(CANDIDATE, job);
    expect(stuck.dimensions.location.score).toBe(0);
  });

  it('detects domain overlap from the description', () => {
    const result = scoreJob(CANDIDATE, makeJob({ description: 'Healthcare records platform' }));
    expect(result.dimensions.domain.score).toBe(0); // no healthcare in candidate text
    expect(result.dimensions.domain.evidence.join(' ')).toContain('healthcare');
  });

  it('is not applicable when the job has no domain signal', () => {
    const result = scoreJob(CANDIDATE, makeJob({ description: 'x'.repeat(500) }));
    expect(result.dimensions.domain.applicable).toBe(false);
  });

  it('scores salary by how much of the candidate range the job covers', () => {
    const result = scoreJob(CANDIDATE, makeJob());
    expect(result.dimensions.salary.score).toBeCloseTo(0.8, 2); // job 95–120k covers 20k of the 90–115k expectation
    expect(result.dimensions.salary.status).toBe('partial');
  });

  it('is not applicable on currency mismatch', () => {
    const job = makeJob({ salaryCurrency: 'GBP' });
    const result = scoreJob(CANDIDATE, job);
    expect(result.dimensions.salary.applicable).toBe(false);
  });

  it('penalizes a salary above the candidate range', () => {
    const job = makeJob({ salaryMin: 200000, salaryMax: 220000 });
    const result = scoreJob(CANDIDATE, job);
    expect(result.dimensions.salary.score).toBe(0);
  });
});

describe('scoreJob hard disqualifiers', () => {
  it('disqualifies when sponsorship is required and the candidate needs it', () => {
    const authJob = makeJob({
      description: 'Must be authorized to work in the EU with no visa sponsorship. ' + 'x'.repeat(300),
    });
    const needsSponsor = scoreJob({ ...CANDIDATE, workAuthorization: '', visaStatus: 'Requires visa sponsorship' }, authJob);
    expect(needsSponsor.eligible).toBe(false);
    expect(needsSponsor.disqualifiers).toEqual(['work-authorization: listing requires authorization the candidate does not evidence']);
  });

  it('does not disqualify a candidate who evidences authorization', () => {
    const authJob = makeJob({
      description: 'Must be authorized to work in the EU with no visa sponsorship. ' + 'x'.repeat(300),
    });
    const result = scoreJob(CANDIDATE, authJob);
    expect(result.eligible).toBe(true);
  });

  it('disqualifies when required experience is vastly out of reach', () => {
    const job = makeJob({
      requirements: [
        { kind: 'Required', category: 'Experience', key: 'backend', name: 'backend experience', minYears: 10, source: 'Deterministic' },
      ],
    });
    const junior = scoreJob({ ...CANDIDATE, experienceYears: 3 }, job);
    expect(junior.eligible).toBe(false);
    expect(junior.disqualifiers.join(' ')).toContain('required-experience');

    const borderline = scoreJob({ ...CANDIDATE, experienceYears: 6 }, job);
    expect(borderline.eligible).toBe(true); // 6y is not below half the 10y requirement
  });
});

describe('scoreJob confidence', () => {
  it('is lower when requirements come from AI and the description is thin', () => {
    const aiRequirements = makeJob().requirements.map((req) => ({ ...req, source: 'AI' as const }));
    const result = scoreJob(CANDIDATE, makeJob({ requirements: aiRequirements, description: 'short' }));
    expect(result.confidence).toBeLessThan(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('is reduced when the candidate has sparse skills', () => {
    const fewSkills = { ...CANDIDATE, skills: [CANDIDATE.skills[0]!] };
    const result = scoreJob(fewSkills, makeJob());
    expect(result.confidence).toBeLessThan(1);
  });

  it('is capped in [0, 1]', () => {
    const result = scoreJob(CANDIDATE, makeJob());
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe('scoreJob totals', () => {
  it('throws when weights do not sum to 100', () => {
    expect(() => scoreJob(CANDIDATE, makeJob(), { weights: { tech: 31, experience: 20, seniority: 15, role: 15, location: 10, domain: 5, salary: 5 } })).toThrow('sum to 100');
  });
});