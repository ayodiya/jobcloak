import { ValidationError } from '@jobs-app/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createArbeitnowJobSource,
  createSponsorshipJobSource,
} from './arbeitnow/ArbeitnowJobSource.js';
import { createJobicyJobSource } from './jobicy/JobicyJobSource.js';
import { createRemoteOkJobSource } from './remoteok/RemoteOkJobSource.js';
import { createRemotiveJobSource } from './remotive/RemotiveJobSource.js';
import { hasJobSource, listJobSources } from './registry.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubJson(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body))),
  );
}

const REMOTE_OK_FIXTURE = [
  { last_updated: 1_750_000_000, legal: 'API terms: please link back' },
  {
    id: 9001,
    slug: 'senior-typescript-engineer',
    epoch: 1_752_400_000,
    company: 'Acme Corp',
    position: 'Senior TypeScript Engineer',
    description: '<p>Build reliable systems.</p>',
    location: '🌍',
    url: 'https://remoteok.com/remote-senior-typescript-engineer-jobs',
  },
  {
    id: 9002,
    slug: 'product-designer',
    epoch: 1_751_600_000,
    company: 'Globex',
    position: 'Product Designer',
    description: '',
    location: 'USA',
    url: 'https://remoteok.com/remote-product-designer-jobs',
  },
];

describe('RemoteOkJobSource', () => {
  it('maps listings and drops the legal/notice prefix', async () => {
    stubJson(REMOTE_OK_FIXTURE);
    const jobs = await createRemoteOkJobSource().search();
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      sourceName: 'remoteok',
      title: 'Senior TypeScript Engineer',
      company: 'Acme Corp',
      remote: true,
      externalId: '9001',
    });
    expect(jobs[0]!.url).toBe('https://remoteok.com/remote-senior-typescript-engineer-jobs');
    expect(jobs[0]!.postedAt?.getUTCFullYear()).toBeGreaterThanOrEqual(2020);
  });

  it('filters by query, remote and location', async () => {
    stubJson(REMOTE_OK_FIXTURE);
    const source = createRemoteOkJobSource();
    await expect(source.search({ query: 'typescript' })).resolves.toHaveLength(1);
    await expect(source.search({ remote: true })).resolves.toHaveLength(2);
    await expect(source.search({ remote: false })).resolves.toHaveLength(0);
    await expect(source.search({ location: 'usa' })).resolves.toHaveLength(1);
  });

  it('returns cached jobs from getJob and reports unhealthy on failures', async () => {
    stubJson(REMOTE_OK_FIXTURE);
    const source = createRemoteOkJobSource();
    const jobs = await source.search();
    await expect(source.getJob(jobs[0]!.url)).resolves.toMatchObject({ company: 'Acme Corp' });

    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    await expect(source.healthCheck()).resolves.toBe(false);
  });
});

const REMOTIVE_FIXTURE = {
  'job-count': 1,
  jobs: [
    {
      id: 2091144,
      url: 'https://remotive.com/remote-jobs/all-others/content-reviewer-united-states-2091144',
      title: 'Content Reviewer - United States',
      company_name: 'TELUS Digital',
      category: 'All others',
      tags: ['android', 'ios'],
      job_type: 'part_time',
      publication_date: '2026-09-21T12:55:11',
      candidate_required_location: 'USA',
      salary: '$45,000 - $60,000',
      description: '<p>Review content categories.</p>',
    },
  ],
};

describe('RemotiveJobSource', () => {
  it('maps listings, salary and employment type', async () => {
    stubJson(REMOTIVE_FIXTURE);
    const [job] = await createRemotiveJobSource().search();
    expect(job).toMatchObject({
      sourceName: 'remotive',
      title: 'Content Reviewer - United States',
      company: 'TELUS Digital',
      remote: true,
      employmentType: 'part time',
      location: 'USA',
      salaryMin: 45000,
      salaryMax: 60000,
      salaryCurrency: 'USD',
      externalId: '2091144',
    });
    expect(job!.postedAt?.getUTCFullYear()).toBe(2026);
  });
});

const JOBICY_FIXTURE = {
  success: true,
  jobCount: 1,
  jobs: [
    {
      id: 154103,
      url: 'https://jobicy.com/jobs/154103-commercial-account-executive',
      jobTitle: 'Commercial Account Executive',
      companyName: 'Tremendous',
      jobIndustry: ['Sales'],
      jobType: ['Full-Time'],
      jobGeo: 'USA',
      jobLevel: 'Director',
      jobExcerpt: 'Short excerpt.',
      jobDescription: '<p>Full description.</p>',
      pubDate: '2026-09-01T00:00:00',
      salaryMin: 120000,
      salaryMax: 150000,
      salaryCurrency: 'USD',
      salaryPeriod: 'year',
    },
  ],
};

describe('JobicyJobSource', () => {
  it('maps listings, salary and seniority', async () => {
    stubJson(JOBICY_FIXTURE);
    const [job] = await createJobicyJobSource().search();
    expect(job).toMatchObject({
      sourceName: 'jobicy',
      title: 'Commercial Account Executive',
      company: 'Tremendous',
      remote: true,
      seniority: 'Director',
      employmentType: 'Full-Time',
      location: 'USA',
      salaryMin: 120000,
      salaryMax: 150000,
      salaryCurrency: 'USD',
    });
    expect(job!.postedAt?.getUTCFullYear()).toBe(2026);
  });

  it('omits null salary fields', async () => {
    stubJson({ success: true, jobs: [{ ...JOBICY_FIXTURE.jobs[0], salaryMin: null }] });
    const [job] = await createJobicyJobSource().search();
    expect(job!.salaryMin).toBeUndefined();
    expect(job!.salaryMax).toBe(150000);
  });
});

const ARBEITNOW_FIXTURE = {
  data: [
    {
      slug: 'sales-manager-berlin-21112',
      company_name: 'Checkout.com',
      title: 'Sales Manager - Berlin',
      description: '<p>We sponsor work visas for international candidates.</p>',
      remote: true,
      url: 'https://www.arbeitnow.com/view/sales-manager-berlin-21112',
      tags: ['Sales'],
      job_types: ['Full Time'],
      location: 'Berlin',
      created_at: 1790541603,
    },
    {
      slug: 'junior-designer-hamburg-7',
      company_name: 'Studio Nord',
      title: 'Junior Designer - Hamburg',
      description: '<p>On-site role in our Hamburg studio.</p>',
      remote: false,
      url: 'https://www.arbeitnow.com/view/junior-designer-hamburg-7',
      tags: ['Design'],
      job_types: ['Full Time'],
      location: 'Hamburg',
      created_at: 1790300000,
    },
  ],
};

describe('ArbeitnowJobSource', () => {
  it('maps listings including explicit remote flag', async () => {
    stubJson(ARBEITNOW_FIXTURE);
    const jobs = await createArbeitnowJobSource().search();
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      sourceName: 'arbeitnow',
      company: 'Checkout.com',
      remote: true,
      location: 'Berlin',
      employmentType: 'Full Time',
      externalId: 'sales-manager-berlin-21112',
    });
    expect(jobs[0]!.postedAt?.getUTCFullYear()).toBe(2026);
  });

  it('accepts created_at as ISO strings as well', async () => {
    const iso = {
      ...ARBEITNOW_FIXTURE,
      data: [{ ...ARBEITNOW_FIXTURE.data[0], created_at: '2026-09-10T00:00:00Z', url: 'u.1' }],
    };
    stubJson(iso);
    const [job] = await createArbeitnowJobSource().search();
    expect(job!.postedAt?.toISOString().slice(0, 10)).toBe('2026-09-10');
  });
});

describe('SponsorshipJobSource', () => {
  it('keeps only listings that mention visa sponsorship or relocation', async () => {
    stubJson(ARBEITNOW_FIXTURE);
    const jobs = await createSponsorshipJobSource().search();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: 'Sales Manager - Berlin',
      sourceName: 'sponsorship',
    });
  });

  it('adjusts the source name via options', async () => {
    stubJson(ARBEITNOW_FIXTURE);
    const named = createArbeitnowJobSource({ name: 'arbeitnow-custom' });
    expect(named.name).toBe('arbeitnow-custom');
    const jobs = await named.search({ query: 'designer' });
    expect(jobs[0]!.sourceName).toBe('arbeitnow-custom');
  });

  it('rejects non-object options', () => {
    expect(() => createArbeitnowJobSource('nope')).toThrow(ValidationError);
    expect(() => createSponsorshipJobSource([1])).toThrow(ValidationError);
  });
});

describe('built-in web sources registry', () => {
  it('registers nigeria, remote and sponsorship sources', () => {
    for (const name of [
      'arbeitnow',
      'jobicy',
      'jobzilla',
      'myjobmag',
      'remoteok',
      'remotive',
      'sponsorship',
    ]) {
      expect(hasJobSource(name)).toBe(true);
    }
    for (const name of ['arbeitnow', 'jobzilla', 'myjobmag', 'remoteok', 'sponsorship']) {
      expect(listJobSources()).toContain(name);
    }
  });
});
