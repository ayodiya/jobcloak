import { NotFoundError, ValidationError } from '@jobs-app/shared';
import type { Job, JobSearchParams } from '../../types.js';
import type { JobSource, JobSourceFactory } from '../JobSource.js';
import { filterJobs } from '../filter.js';

export interface FixtureJobSourceOptions {
  name?: string;
  jobs?: Job[];
}

/**
 * In-memory source backed by static fixtures. Used by tests, local
 * development and demos — it never touches the network.
 */
export class FixtureJobSource implements JobSource {
  readonly name: string;
  readonly kind = 'Fixture' as const;

  private readonly jobs: Job[];

  constructor(options: FixtureJobSourceOptions = {}) {
    this.name = options.name ?? 'fixture';
    this.jobs = options.jobs ?? [];
  }

  async search(params: JobSearchParams = {}): Promise<Job[]> {
    return filterJobs(this.jobs, params);
  }

  async getJob(url: string): Promise<Job> {
    const found = this.jobs.find((job) => job.url === url);
    if (!found) throw new NotFoundError(`Fixture source has no job at ${url}`);
    return found;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

export function createFixtureJobSource(options?: unknown): FixtureJobSource {
  return new FixtureJobSource(parseFixtureOptions(options));
}

function parseFixtureOptions(options: unknown): FixtureJobSourceOptions {
  if (options === undefined || options === null) return {};
  if (typeof options !== 'object') {
    throw new ValidationError('FixtureJobSource options must be an object');
  }
  const { name, jobs } = options as { name?: unknown; jobs?: unknown };
  if (name !== undefined && typeof name !== 'string') {
    throw new ValidationError('FixtureJobSource name must be a string');
  }
  if (jobs !== undefined && !Array.isArray(jobs)) {
    throw new ValidationError('FixtureJobSource jobs must be an array');
  }
  return { name, jobs: jobs as Job[] | undefined };
}

export const fixtureJobSourceFactory: JobSourceFactory = (options) =>
  createFixtureJobSource(options);
