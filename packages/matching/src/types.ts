/** View of the single local candidate required for matching (built from Prisma). */
export interface CandidateView {
  id: string;
  title?: string;
  targetRoles?: string[];
  preferredLocations?: string[];
  remotePreferred?: boolean;
  relocationWilling?: boolean;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  currency?: string;
  languages?: string[];
  workAuthorization?: string;
  visaStatus?: string;
  skills: Array<{
    key: string;
    name: string;
    level?: string;
    years?: number | null;
    lastUsedYear?: number | null;
  }>;
  /** Total experience in years, derived from experience entries. */
  experienceYears: number;
  /** Text used for role/domain keyword matching (titles, orgs, projects). */
  backgroundText: string;
}

/** View of a job listing plus its extracted requirements, ready to score. */
export interface JobMatchView {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  remote: boolean;
  description: string;
  seniority?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  requirements: Array<{
    kind: 'Required' | 'Preferred' | 'NiceToHave';
    category:
      | 'Skill'
      | 'Experience'
      | 'Education'
      | 'Certification'
      | 'Language'
      | 'Other';
    key: string;
    name: string;
    minYears?: number | null;
    source: 'Deterministic' | 'AI';
  }>;
}

export type MatchDimensionKey =
  | 'tech'
  | 'experience'
  | 'seniority'
  | 'role'
  | 'location'
  | 'domain'
  | 'salary';

export type MatchStatus = 'matched' | 'partial' | 'missing' | 'not-applicable';

export interface DimensionResult {
  key: MatchDimensionKey;
  weight: number;
  score: number;
  applicable: boolean;
  status: MatchStatus;
  detail: string;
  evidence: string[];
}

export interface MatchResult {
  jobId: string;
  jobTitle: string;
  company: string;
  /** Weighted average over applicable dimensions, in [0, 1]. */
  totalScore: number;
  /** False when any hard disqualifier fires; score is still reported. */
  eligible: boolean;
  disqualifiers: string[];
  confidence: number;
  dimensions: Record<MatchDimensionKey, DimensionResult>;
}

export interface MatchListFilter {
  eligible?: boolean;
  company?: string;
  status?: 'Active' | 'Closed' | 'Unknown';
  limit?: number;
  offset?: number;
}