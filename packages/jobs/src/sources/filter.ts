import { normalizeText } from '../normalize.js';
import type { Job, JobSearchParams } from '../types.js';

/**
 * Client-side filtering shared by list-style job sources. Mirrors the
 * `FixtureJobSource` contract: substring query/location match, strict `remote`
 * equality, optional `since`, then stable page/limit slicing.
 */
export function filterJobs(jobs: Job[], params: JobSearchParams = {}): Job[] {
  const query = params.query ? normalizeText(params.query).toLowerCase() : undefined;
  const location = params.location ? normalizeText(params.location).toLowerCase() : undefined;

  const matches = jobs.filter((job) => {
    if (
      query &&
      !`${job.title} ${job.company} ${job.description}`.toLowerCase().includes(query)
    ) {
      return false;
    }
    if (location && !(job.location ?? '').toLowerCase().includes(location)) return false;
    if (params.remote !== undefined && Boolean(job.remote) !== params.remote) return false;
    if (params.since && job.postedAt && job.postedAt < params.since) return false;
    return true;
  });

  const limit = params.limit ?? matches.length;
  const page = params.page ?? 1;
  const start = Math.max(0, (page - 1) * limit);
  return matches.slice(start, start + limit);
}

/**
 * Split a listing title of the form "<Role> at <Company>" into parts. Boards
 * that prepend the employer to the role (Nigeria listings in particular) use
 * this to populate the canonical `company` field.
 */

/** Words that are not part of the distinctive role (dropped from keywords). */
const SOFT_KEYWORD_TOKENS = new Set(['senior', 'lead', 'staff']);
/**
 * Tokens that pin a role to an engineering speciality. A keyword that carries
 * any of these must share at least one with the listing title — otherwise
 * generic "engineer"/"developer" tails would make every title match.
 */
const SPECIALTY_KEYWORD_TOKENS = new Set([
  'frontend',
  'backend',
  'full',
  'stack',
  'fullstack',
  'node',
  'nodejs',
  'react',
  'next',
  'nextjs',
  'typescript',
  'javascript',
  'devops',
  'platform',
  'infrastructure',
  'cloud',
  'aws',
  'golang',
  'python',
  'java',
  'ruby',
  'mobile',
  'ios',
  'android',
  'data',
  'sre',
  'qa',
  'security',
]);

/**
 * Case/whitespace-insensitive normalization for keyword matching. Hyphens and
 * en/em dashes become spaces and punctuation is stripped, so the "Full-Stack"
 * family, "node.js"/"NodeJS", and "– Node.js" spellings all align.
 */
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[–—]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when a listing title is relevant to at least one target-role keyword.
 * A keyword matches when at least half of its distinctive tokens appear in
 * the normalized title, and — for keywords that carry a specialty token
 * (node, react, backend, full-stack, ...) — at least one of those specialty
 * tokens also appears. This keeps "Senior Full Stack Engineer" matching a
 * plain "Full Stack Engineer", while "Frontend Engineer" never collapses
 * onto a "Backend Engineer" keyword.
 */
export function matchesAnyKeyword(title: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const titleNorm = normalizeForMatch(title);
  if (!titleNorm) return false;
  return keywords.some((keyword) => {
    const tokens = normalizeForMatch(keyword)
      .split(' ')
      .filter((token) => token.length >= 2 && !SOFT_KEYWORD_TOKENS.has(token));
    if (tokens.length === 0) return false;
    const hits = tokens.filter((token) => titleNorm.includes(token)).length;
    if (hits / tokens.length < 0.5) return false;
    const specialty = tokens.filter((token) => SPECIALTY_KEYWORD_TOKENS.has(token));
    if (specialty.length === 0) return true;
    return specialty.some((token) => titleNorm.includes(token));
  });
}

/** Keep only listings whose title is relevant to one of the target keywords. */
export function filterByKeywords<T extends Job>(jobs: T[], keywords: string[]): T[] {
  if (keywords.length === 0) return jobs;
  return jobs.filter((job) => matchesAnyKeyword(job.title, keywords));
}
export function splitTitleCompany(title: string): { title: string; company?: string } {
  const atIndex = title.lastIndexOf(' at ');
  if (atIndex <= 0) return { title, company: undefined };
  return {
    title: title.slice(0, atIndex).trim(),
    company: title.slice(atIndex + 4).trim(),
  };
}
