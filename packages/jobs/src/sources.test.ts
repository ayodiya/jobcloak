import { NotFoundError, ValidationError } from '@jobs-app/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearJobSources,
  createJobSource,
  hasJobSource,
  listJobSources,
  registerJobSource,
} from './sources/registry.js';
import { createFixtureJobSource } from './sources/fixture/FixtureJobSource.js';
import type { Job } from './types.js';

const JOBS: Job[] = [
  {
    sourceName: 'fixture',
    url: 'https://example.com/jobs/1',
    title: 'Senior TypeScript Engineer',
    company: 'Acme',
    description: 'Build great things with TypeScript.',
    location: 'Berlin',
    remote: true,
    postedAt: new Date('2024-01-15'),
  },
  {
    sourceName: 'fixture',
    url: 'https://example.com/jobs/2',
    title: 'Product Designer',
    company: 'Globex',
    description: 'Design delightful products.',
    location: 'London',
    remote: false,
    postedAt: new Date('2024-02-20'),
  },
];

const name = 'sources-test';

beforeEach(() => {
  registerJobSource(name, () => createFixtureJobSource({ name, jobs: JOBS }));
});

afterEach(() => {
  clearJobSources();
  registerJobSource('fixture', (options) => createFixtureJobSource(options));
});

describe('FixtureJobSource', () => {
  const source = createFixtureJobSource({ jobs: JOBS });

  it('returns matching results for query/location/filters', async () => {
    const results = await source.search({ query: 'typescript' });
    expect(results).toHaveLength(1);
    expect(results[0]?.company).toBe('Acme');

    const byLocation = await source.search({ location: 'london' });
    expect(byLocation.map((j) => j.url)).toEqual(['https://example.com/jobs/2']);

    const byRemote = await source.search({ remote: true });
    expect(byRemote.map((j) => j.url)).toEqual(['https://example.com/jobs/1']);
  });

  it('paginates', async () => {
    const page1 = await source.search({ limit: 1, page: 1 });
    const page2 = await source.search({ limit: 1, page: 2 });
    expect(page1).toHaveLength(1);
    expect(page2).toHaveLength(1);
    expect(page1[0]?.url).not.toBe(page2[0]?.url);
  });

  it('filters by postedAt', async () => {
    const fresh = createFixtureJobSource({
      jobs: [
        ...JOBS,
        { ...JOBS[0]!, url: 'https://example.com/jobs/3', postedAt: new Date('2026-01-01') },
      ],
    });
    const results = await fresh.search({ since: new Date('2025-06-01') });
    expect(results.map((j) => j.url)).toEqual(['https://example.com/jobs/3']);
  });

  it('getJob returns a known listing and throws otherwise', async () => {
    const job = await source.getJob('https://example.com/jobs/2');
    expect(job.title).toBe('Product Designer');
    await expect(source.getJob('https://example.com/jobs/999')).rejects.toThrow(NotFoundError);
  });
});

describe('registry', () => {
  it('has the built-in fixture source', () => {
    expect(hasJobSource('fixture')).toBe(true);
    expect(listJobSources()).toContain('fixture');
  });

  it('instantiates registered sources and rejects unknown names', () => {
    const source = createJobSource(name);
    expect(source.name).toBe(name);
    expect(() => createJobSource('does-not-exist')).toThrow(NotFoundError);
  });

  it('rejects invalid source names and factory/source mismatch', () => {
    expect(() => registerJobSource('not ok', () => createFixtureJobSource())).toThrow(
      ValidationError,
    );
    expect(() => registerJobSource('bad name!', () => createFixtureJobSource())).toThrow(
      ValidationError,
    );
    expect(() =>
      registerJobSource(name, () => createFixtureJobSource({ name: 'other' })),
    ).not.toThrow();
    expect(() => createJobSource(name)).toThrow(ValidationError);
  });

  it('validates fixture options', () => {
    expect(() => createFixtureJobSource('nope')).toThrow(ValidationError);
    expect(() => createFixtureJobSource({ jobs: 'nope' })).toThrow(ValidationError);
    expect(() => createFixtureJobSource({ name: 42 })).toThrow(ValidationError);
  });

  it('registers and overwrites factories', () => {
    const first = createJobSource(name);
    const second = registerJobSource(name, () => createFixtureJobSource({ name }));
    expect(second).toBeUndefined();
    expect(createJobSource(name)).toBeInstanceOf(Object);
    expect(first).toBeInstanceOf(Object);
  });
});