import { parseSalary, toPlainText } from '../../normalize.js';
import type { Job } from '../../types.js';
import type { JobSourceFactory } from '../JobSource.js';
import { keepOnlyListings, ListJobSource } from '../base/ListJobSource.js';
import { fetchJson } from '../http.js';

interface RemotiveItem {
  id?: number;
  url?: string;
  title?: string;
  company_name?: string;
  description?: string;
  candidate_required_location?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  salary?: string;
}

interface RemotiveListResponse {
  jobs?: RemotiveItem[];
}

const REMOTIVE_URL = 'https://remotive.com/api/remote-jobs';

/** Remotive community feed (https://remotive.com/api/remote-jobs). */
export class RemotiveJobSource extends ListJobSource {
  readonly name = 'remotive';

  protected override async fetchJobs(): Promise<Job[]> {
    const payload = await fetchJson<RemotiveListResponse>(REMOTIVE_URL);
    return keepOnlyListings((payload.jobs ?? []).map(toJob));
  }
}

function toJob(item: RemotiveItem): Job {
  const salary = item.salary ? parseSalary(item.salary) : undefined;
  const postedAt = item.publication_date ? new Date(item.publication_date) : undefined;
  return {
    sourceName: 'remotive',
    url: item.url ?? '',
    title: item.title ?? '',
    company: item.company_name ?? '',
    description: toPlainText(item.description ?? ''),
    location: item.candidate_required_location || undefined,
    remote: true,
    employmentType: item.job_type ? item.job_type.replace('_', ' ') : undefined,
    salaryMin: salary?.min,
    salaryMax: salary?.max,
    salaryCurrency: salary?.currency,
    postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : undefined,
    externalId: item.id !== undefined ? String(item.id) : undefined,
    raw: { ...item, tags: item.tags, category: item.category },
  };
}

export function createRemotiveJobSource(): RemotiveJobSource {
  return new RemotiveJobSource();
}

export const remotiveJobSourceFactory: JobSourceFactory = () => createRemotiveJobSource();
