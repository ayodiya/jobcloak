import { toPlainText } from '../../normalize.js';
import type { Job } from '../../types.js';
import type { JobSourceFactory } from '../JobSource.js';
import { keepOnlyListings, ListJobSource } from '../base/ListJobSource.js';
import { toPostedDate } from '../dates.js';
import { fetchJson } from '../http.js';

interface WantedlyCompany {
  name?: string;
}

interface WantedlyItem {
  id?: number;
  title?: string;
  description?: string;
  location?: string;
  published_at?: string | number;
  company?: WantedlyCompany;
  tags?: Array<{ name?: string }>;
}

interface WantedlyListResponse {
  data?: WantedlyItem[];
}

const WANTEDLY_URL = 'https://www.wantedly.com/api/v1/projects';

/**
 * Wantedly public project feed (https://www.wantedly.com/api/v1/projects).
 * Japanese tech/startup roles; text stays in the original language.
 */
export class WantedlyJobSource extends ListJobSource {
  readonly name = 'wantedly';

  protected override async fetchJobs(): Promise<Job[]> {
    const payload = await fetchJson<WantedlyListResponse>(WANTEDLY_URL);
    return keepOnlyListings((payload.data ?? []).map(toJob));
  }
}

function toJob(item: WantedlyItem): Job {
  return {
    sourceName: 'wantedly',
    url: item.id !== undefined ? `https://www.wantedly.com/projects/${item.id}` : '',
    title: item.title ?? '',
    company: item.company?.name ?? '',
    description: toPlainText(item.description ?? ''),
    location: item.location || undefined,
    postedAt: toPostedDate(item.published_at),
    externalId: item.id !== undefined ? String(item.id) : undefined,
    raw: { ...item, tags: item.tags },
  };
}

export function createWantedlyJobSource(): WantedlyJobSource {
  return new WantedlyJobSource();
}

export const wantedlyJobSourceFactory: JobSourceFactory = () => createWantedlyJobSource();
