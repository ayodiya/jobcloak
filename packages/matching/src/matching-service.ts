/**
 * Matching service: loads the candidate profile and a job, scores them
 * deterministically, and persists the explainable result idempotently.
 * Matching is explanatory, never a prediction of hiring success.
 */
import { CandidateRepository } from '@jobs-app/candidate';
import { JobRepository } from '@jobs-app/jobs';
import { AppError, NotFoundError } from '@jobs-app/shared';
import { deriveExperienceYears } from './experience.js';
import { MatchRepository } from './repository.js';
import { scoreJob } from './scorer.js';
import type { CandidateView, JobMatchView, MatchListFilter, MatchResult } from './types.js';
import type { MatchRow, MatchWithDimensions } from './repository.js';

export interface LoadCandidate {
  (): Promise<CandidateView>;
}

export interface LoadJob {
  (jobId: string): Promise<JobMatchView | null>;
}

export interface MatchingServiceDeps {
  repository?: MatchRepository;
  jobs?: JobRepository;
  candidates?: CandidateRepository;
  loadCandidate?: LoadCandidate;
  loadJob?: LoadJob;
  now?: () => Date;
}

export interface MatchOutcome {
  match: MatchRow;
  dimensions: MatchWithDimensions['dimensions'];
  result: MatchResult;
}

export class MatchingService {
  private readonly repository: MatchRepository;
  private readonly jobs: JobRepository;
  private readonly loadCandidate: LoadCandidate;
  private readonly loadJob: LoadJob;
  private readonly now: () => Date;

  constructor(deps: MatchingServiceDeps = {}) {
    this.repository = deps.repository ?? new MatchRepository();
    this.jobs = deps.jobs ?? new JobRepository();
    this.now = deps.now ?? (() => new Date());
    this.loadCandidate = deps.loadCandidate ?? defaultLoadCandidate(deps.candidates ?? new CandidateRepository());
    this.loadJob = deps.loadJob ?? defaultLoadJob(this.jobs);
  }

  /** Score one job against the candidate and persist the result. */
  async matchJob(jobId: string): Promise<MatchOutcome> {
    const job = await this.loadJob(jobId);
    if (!job) throw new NotFoundError(`Job not found: ${jobId}`);
    const candidate = await this.loadCandidate();
    const result = scoreJob(candidate, job);
    const match = await this.repository.upsertMatch(result, this.now());
    const stored = await this.repository.findByJobId(jobId);
    return { match, dimensions: stored?.dimensions ?? [], result };
  }

  /**
   * Score every active job (optionally from one source), paging internally so
   * memory stays bounded. Best-effort per job; failures are summarized with
   * sanitized, semantic error codes only.
   */
  async matchAll(filter: { sourceName?: string } = {}): Promise<{ matchedAt: number; failed: Array<{ jobId: string; code: string; message: string }> }> {
    const failed: Array<{ jobId: string; code: string; message: string }> = [];
    let matchedAt = 0;
    const pageSize = 100;
    let offset = 0;

    while (true) {
      const jobs = await (filter.sourceName
        ? this.jobs.listJobs({ sourceName: filter.sourceName, status: 'Active', limit: pageSize, offset })
        : this.jobs.listJobs({ status: 'Active', limit: pageSize, offset }));
      if (jobs.length === 0) break;

      for (const job of jobs) {
        try {
          await this.matchJob(job.id);
          matchedAt += 1;
        } catch (error) {
          failed.push({ jobId: job.id, ...toErrorSummary(error) });
        }
      }

      if (jobs.length < pageSize) break;
      offset += pageSize;
    }
    return { matchedAt, failed };
  }

  getMatch(jobId: string): Promise<MatchWithDimensions> {
    return this.repository.getMatch(jobId);
  }

  listMatches(filter: MatchListFilter = {}): Promise<MatchWithDimensions[]> {
    return this.repository.listMatches(filter);
  }

  countMatches(filter: MatchListFilter = {}): Promise<number> {
    return this.repository.countMatches(filter);
  }
}

function defaultLoadCandidate(candidates: CandidateRepository): LoadCandidate {
  return async () => {
    const profile = await candidates.findProfile();
    if (!profile) throw new NotFoundError('CandidateProfile not found. Create a profile first.');
    const experience = await candidates.listExperience(profile.id);
    const backgroundText = [
      profile.title,
      ...(asStringArray(profile.targetRoles)),
      ...experience.flatMap((e) => [e.title, e.organization]),
      ...profile.skills.map((s) => s.name),
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id: profile.id,
      title: profile.title ?? undefined,
      targetRoles: asStringArray(profile.targetRoles),
      preferredLocations: asStringArray(profile.preferredLocations),
      remotePreferred: profile.remotePreferred ?? undefined,
      relocationWilling: profile.relocationWilling ?? undefined,
      expectedSalaryMin: profile.expectedSalaryMin ?? undefined,
      expectedSalaryMax: profile.expectedSalaryMax ?? undefined,
      currency: profile.currency ?? undefined,
      languages: asStringArray(profile.languages),
      workAuthorization: profile.workAuthorization ?? undefined,
      visaStatus: profile.visaStatus ?? undefined,
      skills: profile.skills.map((skill) => ({
        key: skill.key,
        name: skill.name,
        level: skill.level,
        years: skill.years,
        lastUsedYear: skill.lastUsedYear,
      })),
      experienceYears: deriveExperienceYears(
        experience.map((entry) => ({ startDate: entry.startDate, endDate: entry.endDate, current: entry.current })),
      ),
      backgroundText,
    };
  };
}

function defaultLoadJob(jobs: JobRepository): LoadJob {
  return async (jobId) => {
    const job = await jobs.findById(jobId);
    if (!job) return null;
    const requirements = await jobs.getRequirements(jobId);
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      remote: job.remote,
      description: job.description,
      seniority: job.seniority,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      requirements: requirements.map((requirement) => ({
        kind: requirement.kind,
        category: requirement.category,
        key: requirement.key,
        name: requirement.name,
        minYears: requirement.minYears,
        source: requirement.source,
      })),
    };
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/** Semantic, safely-displayable error summary for matchAll results. */
function toErrorSummary(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) return { code: error.code, message: error.message };
  return { code: 'INTERNAL', message: 'Unexpected error' };
}