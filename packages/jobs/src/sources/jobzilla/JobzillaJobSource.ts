import { normalizeText } from '../../normalize.js';
import type { Job } from '../../types.js';
import type { JobSourceFactory } from '../JobSource.js';
import { keepOnlyListings, ListJobSource } from '../base/ListJobSource.js';
import { splitTitleCompany } from '../filter.js';
import { fetchText } from '../http.js';

const JOBZILLA_BASE = 'https://www.jobzilla.ng';
const JOBZILLA_LISTINGS = `${JOBZILLA_BASE}/jobs`;

const JOB_LINK = /href="(\/jobs\/[^"]+)"[^>]*>([^<]{6,90})</g;

const NOISE_TEXTS = new Set(['apply now']);

/**
 * Jobzilla (Nigeria) recent listings page (https://www.jobzilla.ng/jobs).
 * The page is a loose list of `/jobs/<slug>-<id>` links; the description is
 * not part of the listing, so it is left empty (normalized downstream).
 */
export class JobzillaJobSource extends ListJobSource {
  readonly name = 'jobzilla';

  protected override async fetchJobs(): Promise<Job[]> {
    const html = await fetchText(JOBZILLA_LISTINGS);
    return keepOnlyListings(parseJobs(html));
  }
}

function parseJobs(html: string): Job[] {
  const seen = new Set<string>();
  const jobs: Job[] = [];
  for (const match of html.matchAll(JOB_LINK)) {
    const href = match[1] ?? '';
    const text = normalizeText(match[2] ?? '');
    if (!href || seen.has(href) || NOISE_TEXTS.has(text.toLowerCase()) || text.length < 8)
      continue;
    seen.add(href);
    const { title, company } = splitTitleCompany(text);
    jobs.push({
      sourceName: 'jobzilla',
      url: `${JOBZILLA_BASE}${href}`,
      title,
      company: company ?? '',
      description: '',
      raw: { listingText: text },
    });
  }
  return jobs;
}

export function createJobzillaJobSource(): JobzillaJobSource {
  return new JobzillaJobSource();
}

export const jobzillaJobSourceFactory: JobSourceFactory = () => createJobzillaJobSource();
