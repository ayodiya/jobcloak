import type { LLMProvider } from '@jobs-app/ai';
import { SourceError, isAppError } from '@jobs-app/shared';
import { normalizeJob, parseJob } from './normalize.js';
import { JobRepository } from './repository.js';
import { extractRequirements } from './requirements.js';
import { extractRequirementsWithAI } from './requirements-ai.js';
import { filterByKeywords } from './sources/filter.js';
import { createJobSource } from './sources/registry.js';
import type {
  DiscoverySummary,
  Job,
  JobListFilter,
  JobRequirementInput,
  JobSearchParams,
  NormalizedJob,
} from './types.js';
import type { JobRow, RequirementRow } from './repository.js';

export interface JobServiceAiOptions {
  provider: LLMProvider;
  model?: string;
}

export interface JobServiceOptions {
  repository?: JobRepository;
  /** Optional AI assist for requirement extraction (deterministic still runs). */
  ai?: JobServiceAiOptions;
  now?: () => Date;
}

export interface DiscoverOptions {
  sourceName: string;
  params?: JobSearchParams;
  sourceOptions?: unknown;
  /** Request AI-assisted requirement extraction for this run. */
  useAI?: boolean;
  /**
   * Target-role keywords. When provided, listings whose title is not relevant
   * to one of the keywords are dropped before normalization (see filter.ts).
   */
  keywords?: string[];
}

/**
 * Orchestrates discovery: fetch → validate → normalize → dedupe-upsert →
 * extract requirements → record source health. Discovery is best-effort: a
 * failing source is recorded unhealthy and reported, not thrown. Unknown
 * source names still fail fast (configuration error).
 */
export class JobService {
  private readonly repository: JobRepository;
  private readonly ai?: JobServiceAiOptions;
  private readonly now: () => Date;

  constructor(options: JobServiceOptions = {}) {
    this.repository = options.repository ?? new JobRepository();
    this.ai = options.ai;
    this.now = options.now ?? (() => new Date());
  }

  async discover(options: DiscoverOptions): Promise<DiscoverySummary> {
    const source = createJobSource(options.sourceName, options.sourceOptions);
    const summary: DiscoverySummary = {
      sourceName: options.sourceName,
      fetched: 0,
      rejected: 0,
      created: 0,
      updated: 0,
      requirementCount: 0,
      healthy: true,
    };

    try {
      const found = await source.search(options.params ?? {});
      summary.fetched = found.length;
      const { jobs, rejected } = this.toNormalized(found);
      summary.rejected = rejected;

      const kept = options.keywords ? filterByKeywords(jobs, options.keywords) : jobs;
      if (kept.length !== jobs.length) summary.filtered = jobs.length - kept.length;

      for (const job of kept) {
        const { job: row, created } = await this.repository.upsertJob(job, this.now());
        if (created) summary.created += 1;
        else summary.updated += 1;

        const requirements = await this.extract(job, options.useAI === true);
        await this.repository.replaceRequirements(row.id, requirements);
        summary.requirementCount += requirements.length;
      }

      await this.repository.recordSourceHealth(
        { sourceName: options.sourceName, healthy: true },
        this.now(),
      );
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.recordSourceHealth(
        { sourceName: options.sourceName, healthy: false, error: message },
        this.now(),
      );
      return { ...summary, healthy: false, error: message };
    }
  }

  /** Fetch and persist a single listing by URL. */
  async getJob(
    sourceName: string,
    url: string,
  ): Promise<{ job: JobRow; requirements: RequirementRow[] }> {
    const source = createJobSource(sourceName);
    const raw = await source.getJob(url);
    const job = this.normalizeOne(raw);
    const { job: row } = await this.repository.upsertJob(job, this.now());
    const requirements = await this.extract(job, false);
    await this.repository.replaceRequirements(row.id, requirements);
    return { job: row, requirements: await this.repository.getRequirements(row.id) };
  }

  listJobs(filter: JobListFilter = {}): Promise<JobRow[]> {
    return this.repository.listJobs(filter);
  }

  listSourceHealth() {
    return this.repository.listSourceHealth();
  }

  private toNormalized(jobs: Job[]): { jobs: NormalizedJob[]; rejected: number } {
    const normalized: NormalizedJob[] = [];
    let rejected = 0;
    for (const raw of jobs) {
      try {
        normalized.push(this.normalizeOne(raw));
      } catch {
        rejected += 1;
      }
    }
    return { jobs: normalized, rejected };
  }

  private normalizeOne(raw: Job): NormalizedJob {
    try {
      return normalizeJob(parseJob(raw));
    } catch (error) {
      if (isAppError(error)) throw error;
      throw new SourceError('Failed to normalize job listing', { cause: error });
    }
  }

  private async extract(job: NormalizedJob, useAI: boolean): Promise<JobRequirementInput[]> {
    const deterministic = extractRequirements(job.description);
    if (!useAI || !this.ai) return deterministic;
    return extractRequirementsWithAI(job.description, deterministic, {
      provider: this.ai.provider,
      ...(this.ai.model !== undefined ? { model: this.ai.model } : {}),
    });
  }
}
