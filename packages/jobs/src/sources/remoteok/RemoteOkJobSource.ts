import { toPlainText } from '../../normalize.js';
import type { Job } from '../../types.js';
import type { JobSourceFactory } from '../JobSource.js';
import { keepOnlyListings, ListJobSource } from '../base/ListJobSource.js';
import { fetchJson } from '../http.js';

interface RemoteOkItem {
  id?: number;
  slug?: string;
  epoch?: number;
  company?: string;
  position?: string;
  description?: string;
  location?: string;
  url?: string;
}

const REMOTE_OK_URL = 'https://remoteok.com/api';

/**
 * RemoteOK feed (https://remoteok.com/api). The response is a bare JSON array
 * whose first element is a legal/notice object rather than a listing.
 */
export class RemoteOkJobSource extends ListJobSource {
  readonly name = 'remoteok';

  protected override async fetchJobs(): Promise<Job[]> {
    const payload = await fetchJson<unknown[]>(REMOTE_OK_URL);
    return keepOnlyListings(payload.map(toJob));
  }
}

function toJob(item: unknown): Job {
  const input = item as RemoteOkItem;
  const description = toPlainText(input.description ?? '');
  return {
    sourceName: 'remoteok',
    url: input.url ?? `https://remoteok.com/remote-${input.slug ?? input.id}-jobs`,
    title: input.position ?? '',
    company: input.company ?? '',
    description,
    location: input.location ? toPlainText(input.location) : undefined,
    remote: true,
    postedAt: input.epoch ? new Date(input.epoch * 1000) : undefined,
    externalId: input.id !== undefined ? String(input.id) : input.slug,
    raw: input,
  };
}

export function createRemoteOkJobSource(): RemoteOkJobSource {
  return new RemoteOkJobSource();
}

export const remoteOkJobSourceFactory: JobSourceFactory = () => createRemoteOkJobSource();
