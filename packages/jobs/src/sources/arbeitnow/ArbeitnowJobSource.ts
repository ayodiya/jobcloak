import { toPlainText } from '../../normalize.js';
import type { Job } from '../../types.js';
import type { JobSourceFactory } from '../JobSource.js';
import { keepOnlyListings, ListJobSource } from '../base/ListJobSource.js';
import { toPostedDate } from '../dates.js';
import { fetchJson, parseSourceOptions } from '../http.js';

interface ArbeitnowItem {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: string;
}

interface ArbeitnowListResponse {
  data?: ArbeitnowItem[];
}

export interface ArbeitnowJobSourceOptions {
  name?: string;
  /** Keep only roles whose listing indicates employer-sponsored visas. */
  sponsorshipOnly?: boolean;
}

const ARBEITNOW_URL = 'https://www.arbeitnow.com/api/job-board-api';

/** Keyword language used to identify sponsorships; intentionally broad to avoid misses. */
const SPONSORSHIP_PATTERN =
  /(visa\s?sponsor|sponsor(?:ing|ed|ship)|work\s?permit|work\s?visa|visa\s?support|relocat(?:e|ing|ion|ion\s?pack))/i;

/**
 * Arbeitnow feed (https://www.arbeitnow.com/api/job-board-api). The board is
 * Europe-heavy; the `sponsorshipOnly` variant exposes only roles whose
 * description or tags indicate employer visa sponsorship or relocation.
 */
export class ArbeitnowJobSource extends ListJobSource {
  readonly name: string;

  private readonly sponsorshipOnly: boolean;

  constructor(options: ArbeitnowJobSourceOptions = {}) {
    super();
    this.name = options.name ?? 'arbeitnow';
    this.sponsorshipOnly = options.sponsorshipOnly ?? false;
  }

  protected override async fetchJobs(): Promise<Job[]> {
    const payload = await fetchJson<ArbeitnowListResponse>(ARBEITNOW_URL);
    const items = payload.data ?? [];
    return keepOnlyListings(items.map((item) => toJob(this.name, item))).filter(
      (job) => !this.sponsorshipOnly || mentionsSponsorship(job),
    );
  }
}

function toJob(sourceName: string, item: ArbeitnowItem): Job {
  return {
    sourceName,
    url: item.url ?? '',
    title: item.title ?? '',
    company: item.company_name ?? '',
    description: toPlainText(item.description ?? ''),
    location: item.location || undefined,
    remote: Boolean(item.remote),
    employmentType: item.job_types?.length ? item.job_types.join(', ') : undefined,
    postedAt: toPostedDate(item.created_at),
    externalId: item.slug,
    raw: { ...item, tags: item.tags },
  };
}

function mentionsSponsorship(job: Job): boolean {
  const tags = (job.raw as ArbeitnowItem | undefined)?.tags?.join(' ') ?? '';
  return SPONSORSHIP_PATTERN.test(`${job.description} ${tags}`);
}

export function createArbeitnowJobSource(options?: unknown): ArbeitnowJobSource {
  return new ArbeitnowJobSource(parseSourceOptions(options) as ArbeitnowJobSourceOptions);
}

export const arbeitnowJobSourceFactory: JobSourceFactory = (options) =>
  createArbeitnowJobSource(options);

/** Sponsorship view over the Arbeitnow feed (source name `sponsorship`). */
export function createSponsorshipJobSource(options?: unknown): ArbeitnowJobSource {
  const parsed = { ...parseSourceOptions(options), name: 'sponsorship', sponsorshipOnly: true };
  return new ArbeitnowJobSource(parsed as ArbeitnowJobSourceOptions);
}

export const sponsorshipJobSourceFactory: JobSourceFactory = (options) =>
  createSponsorshipJobSource(options);
