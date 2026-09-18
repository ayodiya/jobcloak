import type { Job, JobSearchParams, JobSourceKind } from '../types.js';

/**
 * A permitted source of job listings.
 *
 * Contract:
 * - `search` returns normalized-enough jobs (the jobs package canonicalizes
 *   further, deduplicates and extracts requirements).
 * - `getJob` fetches a single listing by URL.
 * - `healthCheck` reports reachability only; it must not mutate state.
 *
 * Sources must respect robots.txt, terms, rate limits and access controls.
 * Never bypass CAPTCHA, authentication, paywalls or anti-bot protections.
 */
export interface JobSource {
  readonly name: string;
  readonly kind?: JobSourceKind;
  search(params: JobSearchParams): Promise<Job[]>;
  getJob(url: string): Promise<Job>;
  healthCheck(): Promise<boolean>;
}

export type JobSourceFactory = (options?: unknown) => JobSource;
