import { toPlainText } from '../../normalize.js';
import type { Job } from '../../types.js';
import type { JobSourceFactory } from '../JobSource.js';
import { keepOnlyListings, ListJobSource } from '../base/ListJobSource.js';
import { fetchJson } from '../http.js';

interface JobicyItem {
  id?: number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
}

interface JobicyListResponse {
  jobs?: JobicyItem[];
}

const JOBICY_URL = 'https://jobicy.com/api/v2/remote-jobs';

/** Jobicy remote feed (https://jobicy.com/api/v2/remote-jobs). */
export class JobicyJobSource extends ListJobSource {
  readonly name = 'jobicy';

  protected override async fetchJobs(): Promise<Job[]> {
    const payload = await fetchJson<JobicyListResponse>(JOBICY_URL);
    return keepOnlyListings((payload.jobs ?? []).map(toJob));
  }
}

function toJob(item: JobicyItem): Job {
  const postedAt = item.pubDate ? new Date(item.pubDate) : undefined;
  return {
    sourceName: 'jobicy',
    url: item.url ?? '',
    title: item.jobTitle ?? '',
    company: item.companyName ?? '',
    description: toPlainText(item.jobDescription ?? item.jobExcerpt ?? ''),
    location: item.jobGeo || undefined,
    remote: true,
    employmentType: item.jobType?.length ? item.jobType.join(', ') : undefined,
    seniority: item.jobLevel || undefined,
    salaryMin: isNonNegativeInt(item.salaryMin) ? item.salaryMin : undefined,
    salaryMax: isNonNegativeInt(item.salaryMax) ? item.salaryMax : undefined,
    salaryCurrency: item.salaryCurrency || undefined,
    postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : undefined,
    externalId: item.id !== undefined ? String(item.id) : undefined,
    raw: { ...item, jobIndustry: item.jobIndustry },
  };
}

function isNonNegativeInt(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)
  );
}

export function createJobicyJobSource(): JobicyJobSource {
  return new JobicyJobSource();
}

export const jobicyJobSourceFactory: JobSourceFactory = () => createJobicyJobSource();
