import { toPlainText } from '../../normalize.js';
import type { Job } from '../../types.js';
import type { JobSourceFactory } from '../JobSource.js';
import { keepOnlyListings, ListJobSource } from '../base/ListJobSource.js';
import { fetchText, parseSourceOptions } from '../http.js';

export interface BerlinStartupJobsOptions {
  /** Category paths to crawl; default is the engineering board. */
  categories?: string[];
}

const BSC_BASE = 'https://berlinstartupjobs.com';
const DEFAULT_CATEGORIES = ['/engineering/'];

const CARD_MARKER = '<li class="bjs-jlid">';
const JOB_ANCHOR = /href="(https:\/\/berlinstartupjobs\.com\/[^"]+)"[^>]*>([^<]+)</;
const COMPANY_ANCHOR = /class="bjs-jlid__b"[^>]*>([^<]+)<\/a>/;

/**
 * Berlin Startup Jobs (https://berlinstartupjobs.com) — Berlin/Germany roles.
 * Each `<li class="bjs-jlid">` card pairs a job title link with a company
 * link (`bjs-jlid__h` + `bjs-jlid__b`).
 */
export class BerlinStartupJobsJobSource extends ListJobSource {
  readonly name = 'berlinstartupjobs';

  private readonly categories: string[];

  constructor(options: BerlinStartupJobsOptions = {}) {
    super();
    this.categories = options.categories ?? DEFAULT_CATEGORIES;
  }

  protected override async fetchJobs(): Promise<Job[]> {
    const pages = await Promise.all(
      this.categories.map((path) => fetchText(`${BSC_BASE}${path}`)),
    );
    const jobs: Job[] = [];
    for (const html of pages) jobs.push(...extractCards(html));
    return keepOnlyListings(jobs);
  }
}

function extractCards(html: string): Job[] {
  const cards: Job[] = [];
  let index = 0;
  while (true) {
    const start = html.indexOf(CARD_MARKER, index);
    if (start === -1) break;
    const end = html.indexOf(CARD_MARKER, start + CARD_MARKER.length);
    const card = parseCard(html.slice(start, end === -1 ? undefined : end));
    if (card) cards.push(card);
    index = start + CARD_MARKER.length;
  }
  return cards;
}

function parseCard(block: string): Job | undefined {
  const jobMatch = block.match(JOB_ANCHOR);
  const companyMatch = block.match(COMPANY_ANCHOR);
  if (!jobMatch) return undefined;
  const url = jobMatch[1] ?? '';
  const title = toPlainText(jobMatch[2] ?? '');
  const company = companyMatch ? toPlainText(companyMatch[1] ?? '') : '';
  return {
    sourceName: 'berlinstartupjobs',
    url,
    title,
    company,
    description: toPlainText(
      block.match(/bjs-jlid__description">([\s\S]*?)<\/div>/)?.[1] ?? '',
    ),
    raw: block,
  };
}

export function createBerlinStartupJobsJobSource(
  options?: unknown,
): BerlinStartupJobsJobSource {
  const parsed = parseSourceOptions(options) as BerlinStartupJobsOptions;
  return new BerlinStartupJobsJobSource({ categories: parsed.categories });
}

export const berlinStartupJobsJobSourceFactory: JobSourceFactory = (options) =>
  createBerlinStartupJobsJobSource(options);
