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
export function splitTitleCompany(title: string): { title: string; company?: string } {
  const atIndex = title.lastIndexOf(' at ');
  if (atIndex <= 0) return { title, company: undefined };
  return {
    title: title.slice(0, atIndex).trim(),
    company: title.slice(atIndex + 4).trim(),
  };
}
