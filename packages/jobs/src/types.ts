/** Canonical job shape exchanged between sources, normalization and storage. */
export interface Job {
  sourceName: string;
  url: string;
  title: string;
  company: string;
  description: string;
  location?: string;
  remote?: boolean;
  employmentType?: string;
  seniority?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  postedAt?: Date;
  externalId?: string;
  raw?: unknown;
}

/** Normalized job adds canonical URL, fingerprint and derived flags. */
export interface NormalizedJob extends Job {
  normalizedUrl: string;
  fingerprint: string;
  remote: boolean;
}

export type JobSourceKind = 'Api' | 'Fixture' | 'Manual';

export interface JobSearchParams {
  query?: string;
  location?: string;
  remote?: boolean;
  page?: number;
  limit?: number;
  since?: Date;
}

export type RequirementKind = 'Required' | 'Preferred' | 'NiceToHave';
export type RequirementCategory =
  'Skill' | 'Experience' | 'Education' | 'Certification' | 'Language' | 'Other';
export type RequirementSource = 'Deterministic' | 'AI';

export interface JobRequirementInput {
  kind: RequirementKind;
  category: RequirementCategory;
  key: string;
  name: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  minYears?: number;
  detail?: string;
  source: RequirementSource;
  confidence?: number;
}

export interface JobWithRequirements extends NormalizedJob {
  id: string;
}

export interface JobListFilter {
  sourceName?: string;
  remote?: boolean;
  company?: string;
  status?: 'Active' | 'Closed' | 'Unknown';
  limit?: number;
  offset?: number;
}

export interface SourceHealthResult {
  sourceName: string;
  healthy: boolean;
  error?: string;
}

export interface DiscoverySummary {
  sourceName: string;
  fetched: number;
  /** Listings dropped because they did not relevance-match the target keywords. */
  filtered?: number;
  rejected: number;
  created: number;
  updated: number;
  requirementCount: number;
  healthy: boolean;
  error?: string;
}
