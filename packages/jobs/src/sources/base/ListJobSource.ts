import { NotFoundError } from '@jobs-app/shared';
import type { Job, JobSearchParams, JobSourceKind } from '../../types.js';
import type { JobSource } from '../JobSource.js';
import { filterJobs } from '../filter.js';

/**
 * Base class for web sources backed by a single listings fetch. Concrete
 * sources implement `fetchJobs()` (HTTP + parsing) and inherit search,
 * `getJob` and health-check behaviour.
 */
export abstract class ListJobSource implements JobSource {
  abstract readonly name: string;
  readonly kind: JobSourceKind = 'Api';

  /** Most recent listings, used to resolve `getJob(url)` without refetching. */
  protected lastJobs: Job[] = [];

  protected abstract fetchJobs(): Promise<Job[]>;

  async search(params: JobSearchParams = {}): Promise<Job[]> {
    this.lastJobs = await this.fetchJobs();
    return filterJobs(this.lastJobs, params);
  }

  async getJob(url: string): Promise<Job> {
    const found = this.lastJobs.find((job) => job.url === url);
    if (!found) throw new NotFoundError(`Source '${this.name}' has no cached job at ${url}`);
    return found;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const jobs = await this.fetchJobs();
      return jobs.length > 0;
    } catch {
      return false;
    }
  }
}

/** Drop degraded entries so downstream parsing only sees complete jobs. */
export function keepOnlyListings(jobs: Job[]): Job[] {
  return jobs.filter((job) => Boolean(job.sourceName && job.url && job.title && job.company));
}
