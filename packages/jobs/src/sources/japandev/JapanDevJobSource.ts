import { normalizeText } from '../../normalize.js';
import type { Job } from '../../types.js';
import type { JobSourceFactory } from '../JobSource.js';
import { keepOnlyListings, ListJobSource } from '../base/ListJobSource.js';
import { fetchText } from '../http.js';

const JAPAN_DEV_BASE = 'https://japan-dev.com';

/** `/jobs/<company>/<slug>` listings; `/jobs` and `/employer/jobs` are UI pages. */
const JOB_LINK = /href="(\/jobs\/[^"]+)"[^>]*>([^<]{5,140})</g;

/**
 * Japan Dev (https://japan-dev.com) — English-friendly developer roles in
 * Japan. The company slug in each listing URL serves as the employer name.
 */
export class JapanDevJobSource extends ListJobSource {
  readonly name = 'japan-dev';

  protected override async fetchJobs(): Promise<Job[]> {
    const html = await fetchText(`${JAPAN_DEV_BASE}/`);
    return keepOnlyListings(parseJobs(html));
  }
}

function parseJobs(html: string): Job[] {
  const seen = new Set<string>();
  const jobs: Job[] = [];
  for (const match of html.matchAll(JOB_LINK)) {
    const href = match[1] ?? '';
    const companyMatch = href.match(/^\/jobs\/([^/]+)\/[^/]+$/);
    if (!companyMatch) continue;
    const title = normalizeText(match[2] ?? '');
    if (!title) continue;
    const company = normalizeText(companyMatch[1] ?? '');
    if (seen.has(href)) continue;
    seen.add(href);
    jobs.push({
      sourceName: 'japan-dev',
      url: `${JAPAN_DEV_BASE}${href}`,
      title,
      company,
      description: '',
      raw: { href },
    });
  }
  return jobs;
}

export function createJapanDevJobSource(): JapanDevJobSource {
  return new JapanDevJobSource();
}

export const japanDevJobSourceFactory: JobSourceFactory = () => createJapanDevJobSource();
