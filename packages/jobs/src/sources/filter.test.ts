import { describe, expect, it } from 'vitest';
import type { Job } from '../types.js';
import { filterByKeywords, matchesAnyKeyword } from './filter.js';

function job(overrides: Partial<Job> = {}): Job {
  return {
    sourceName: 'fixture',
    title: 'Senior Backend Engineer at Acme',
    company: 'Acme',
    url: 'https://example.com/j/1',
    description: 'TypeScript, Node.js, PostgreSQL',
    remote: false,
    postedAt: new Date('2026-09-01'),
    ...overrides,
  };
}

const KEYWORDS = [
  'Senior Full Stack Engineer',
  'Full-Stack Developer',
  'Senior Backend Engineer',
  'Node.js Backend Engineer',
  'Node.js Developer',
  'Software Engineer – Node.js',
  'React Developer',
  'Next.js Developer',
  'Tech Lead',
];

describe('matchesAnyKeyword', () => {
  it('is false for an empty keyword list', () => {
    expect(matchesAnyKeyword('Senior Backend Engineer', [])).toBe(false);
    expect(matchesAnyKeyword('', KEYWORDS)).toBe(false);
  });

  it('matches an exact title', () => {
    expect(matchesAnyKeyword('Senior Backend Engineer', ['Senior Backend Engineer'])).toBe(
      true,
    );
  });

  it('drops seniority words so a plain title still matches a senior keyword', () => {
    expect(matchesAnyKeyword('Full Stack Engineer', ['Senior Full Stack Engineer'])).toBe(true);
    expect(matchesAnyKeyword('Backend Engineer', ['Senior Backend Engineer'])).toBe(true);
  });

  it('treats full-stack, fullstack and full stack as the same family', () => {
    expect(matchesAnyKeyword('Full-Stack Developer', ['Full Stack Developer'])).toBe(true);
    expect(matchesAnyKeyword('Fullstack Engineer', ['Senior Full Stack Engineer'])).toBe(true);
  });

  it('matches partial-token overlaps such as backend software engineer', () => {
    expect(matchesAnyKeyword('Backend Software Engineer', ['Senior Backend Engineer'])).toBe(
      true,
    );
  });

  it('handles the en-dash "Software Engineer – Node.js" keyword', () => {
    expect(matchesAnyKeyword('Node.js Engineer', ['Software Engineer – Node.js'])).toBe(true);
  });

  it('keeps distinct stacks apart', () => {
    expect(matchesAnyKeyword('React Developer', ['Node.js Backend Engineer'])).toBe(false);
    expect(matchesAnyKeyword('Senior React Developer', ['Node.js Developer'])).toBe(false);
    expect(matchesAnyKeyword('Frontend Engineer', ['Backend Engineer'])).toBe(false);
    expect(matchesAnyKeyword('Android Engineer', ['Tech Lead'])).toBe(false);
  });

  it('matches node.js/NodeJS spelling differences', () => {
    expect(matchesAnyKeyword('NodeJS Developer', ['Node.js Developer'])).toBe(true);
    expect(matchesAnyKeyword('Node.js Developer', ['NodeJS Developer'])).toBe(true);
  });

  it('matches next.js against a listing title', () => {
    expect(matchesAnyKeyword('Next.js Developer', ['Next.js Developer'])).toBe(true);
  });
});

describe('filterByKeywords', () => {
  it('returns every job when the keyword list is empty', () => {
    const jobs = [job({ title: 'Anything' }), job({ title: 'Whatever' })];
    expect(filterByKeywords(jobs, [])).toHaveLength(2);
  });

  it('keeps only relevant listings', () => {
    const jobs = [
      job({ title: 'Senior Backend Engineer at Acme' }),
      job({ title: 'Full Stack Developer at Globex' }),
      job({ title: 'WordPress Editor' }),
      job({ title: 'React Native App Developer' }),
    ];
    const kept = filterByKeywords(jobs, KEYWORDS);
    expect(kept.map((j) => j.title)).toEqual([
      'Senior Backend Engineer at Acme',
      'Full Stack Developer at Globex',
      'React Native App Developer',
    ]);
  });

  it('drops a React Native role when React keywords are not targeted', () => {
    const jobs = [
      job({ title: 'React Native App Developer' }),
      job({ title: 'Node.js Backend Engineer' }),
    ];
    const kept = filterByKeywords(jobs, [
      'Node.js Backend Engineer',
      'Senior Backend Engineer',
    ]);
    expect(kept.map((j) => j.title)).toEqual(['Node.js Backend Engineer']);
  });
});
