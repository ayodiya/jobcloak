import { normalizeText, toPlainText } from '../../normalize.js';
import type { Job } from '../../types.js';
import type { JobSourceFactory } from '../JobSource.js';
import { keepOnlyListings, ListJobSource } from '../base/ListJobSource.js';
import { splitTitleCompany } from '../filter.js';
import { fetchText } from '../http.js';

const MYJOBMAG_BASE = 'https://www.myjobmag.com';
const MYJOBMAG_LISTINGS = `${MYJOBMAG_BASE}/jobs`;

const CARD_MARKER = '<li class="job-list-li">';

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

interface MyJobMagCard {
  title: string;
  company: string;
  href: string;
  description: string;
  date?: Date;
}

/**
 * MyJobMag (Nigeria) recent listings page (https://www.myjobmag.com/jobs).
 * Each card is a `<li class="job-list-li">` block containing a `/job/<slug>`
 * link, a truncated description and a human date like "26 September".
 */
export class MyJobMagJobSource extends ListJobSource {
  readonly name = 'myjobmag';

  protected override async fetchJobs(): Promise<Job[]> {
    const html = await fetchText(MYJOBMAG_LISTINGS);
    return keepOnlyListings(extractJobListBlocks(html).map(toJob));
  }
}

function extractJobListBlocks(html: string): string[] {
  const blocks: string[] = [];
  let index = 0;
  while (true) {
    const start = html.indexOf(CARD_MARKER, index);
    if (start === -1) break;
    const end = html.indexOf(CARD_MARKER, start + CARD_MARKER.length);
    blocks.push(html.slice(start, end === -1 ? undefined : end));
    index = start + CARD_MARKER.length;
  }
  return blocks;
}

function toJob(block: string): Job {
  const card = parseCard(block);
  return {
    sourceName: 'myjobmag',
    url: `${MYJOBMAG_BASE}${card.href}`,
    title: card.title,
    company: card.company,
    description: card.description,
    postedAt: card.date,
    raw: block,
  };
}

function parseCard(block: string): MyJobMagCard {
  const title = extractTitle(block);
  const { title: role, company: fromTitle } = splitTitleCompany(title);
  const logoCompany = block.match(/alt="([^"]+)"\s*width="100%"/)?.[1]?.replace(/ logo$/i, '');
  const company = fromTitle ?? (logoCompany && normalizeText(logoCompany)) ?? '';

  return {
    title: role,
    company,
    href: block.match(/href="(\/job\/[^"]+)"/)?.[1] ?? '',
    description: toPlainText(block.match(/class="job-desc">([\s\S]*?)<\/li>/)?.[1] ?? ''),
    date: parseCardDate(block.match(/id="job-date"[^>]*>([^<]+)</)?.[1] ?? ''),
  };
}

function extractTitle(block: string): string {
  const match = block.match(/<h2><a[^>]*>([\s\S]*?)<\/a><\/h2>/);
  return match ? toPlainText(match[1] ?? '') : '';
}

/** Parse "26 September", "Yesterday" or "Today" into a date (year inferred). */
function parseCardDate(text: string, now: Date = new Date()): Date | undefined {
  const raw = text.trim();
  if (/^today$/i.test(raw)) return now;
  if (/^yesterday$/i.test(raw)) {
    const day = new Date(now.getTime());
    day.setDate(day.getDate() - 1);
    return day;
  }
  const match = raw.match(/^(\d{1,2})\s+([a-z]+)$/i);
  if (!match) return undefined;
  const month = MONTHS[match[2]!.toLowerCase()];
  if (month === undefined || !/^\d{1,2}$/.test(match[1]!)) return undefined;
  const day = Number(match[1]);
  if (day < 1 || day > 31) return undefined;
  const year = now.getFullYear();
  const candidate = new Date(Date.UTC(year, month, day));
  if (candidate.getTime() > now.getTime()) candidate.setUTCFullYear(year - 1);
  return candidate;
}

export function createMyJobMagJobSource(): MyJobMagJobSource {
  return new MyJobMagJobSource();
}

export const myJobMagJobSourceFactory: JobSourceFactory = () => createMyJobMagJobSource();
