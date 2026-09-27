import { useQueryClient, useMutation } from '@tanstack/react-query';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3100';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(
      response.status,
      text.trim() ? text.trim() : `Request failed (${response.status})`,
    );
  }
  return (await response.json()) as T;
}

/** Builds a query string from defined values, skipping empty/undefined ones. */
export function listParams(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const value = search.toString();
  return value ? `?${value}` : '';
}

export type JobStatus = 'Active' | 'Closed' | 'Unknown';
export type ApplicationStatus =
  'Prepared' | 'InProgress' | 'Submitted' | 'Verified' | 'Failed' | 'Cancelled' | 'Rejected';
export type ApplicationMode = 'safe' | 'review' | 'auto_apply';

export const JOB_STATUSES: JobStatus[] = ['Active', 'Closed', 'Unknown'];
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Prepared',
  'InProgress',
  'Submitted',
  'Verified',
  'Failed',
  'Cancelled',
  'Rejected',
];
export const APPLICATION_MODES: ApplicationMode[] = ['safe', 'review', 'auto_apply'];

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface JobMatchRef {
  id: string;
  totalScore: number;
  eligible: boolean;
}

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  url: string;
  normalizedUrl: string;
  status: string;
  postedAt: string | null;
  discoveredAt: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  requirementsCount: number;
  match: JobMatchRef | null;
}

export interface JobDetail extends JobListItem {
  sourceName: string;
  description: string;
  employmentType: string | null;
  seniority: string | null;
  lastSeenAt: string;
  requirements: Array<{
    kind: string;
    category: string;
    key: string;
    name: string;
    minYears: number | null;
  }>;
  matchDimensions: Array<{
    key: string;
    weight: number;
    score: number;
    applicable: boolean;
    status: string;
    detail: string | null;
  }>;
  applicationsCount: number;
}

export interface MatchListItem {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  totalScore: number;
  eligible: boolean;
  confidence: number;
  createdAt: string;
  dimensions: Array<{
    key: string;
    weight: number;
    score: number;
    status: string;
    detail: string | null;
  }>;
}

export interface JobRef {
  id: string;
  title: string;
  company: string;
  remote: boolean;
  location: string | null;
  url: string;
}

export interface ApplicationListItem {
  id: string;
  status: string;
  mode: string;
  sourceName: string | null;
  url: string;
  submissionKey: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  job: JobRef;
}

export interface ApplicationDetail extends ApplicationListItem {
  jobId: string;
  profileId: string;
  events: Array<{
    id: string;
    type: string;
    stage: string | null;
    payload: unknown;
    at: string;
  }>;
}

export interface DashboardResponse {
  generatedAt: string;
  counts: {
    jobs: number;
    activeJobs: number;
    matchesEligible: number;
    applicationsByStatus: Record<string, number>;
    materials: number;
    sourcesHealthy: number;
    sourcesTotal: number;
  };
  recentApplications: Array<{
    id: string;
    status: string;
    mode: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    job: JobRef;
  }>;
  topMatches: Array<{
    matchId: string;
    jobId: string;
    jobTitle: string;
    company: string;
    totalScore: number;
    eligible: boolean;
    confidence: number;
  }>;
  automation: { blockedEvents: number; inQueue: number };
}

export interface SourceItem {
  sourceName: string;
  healthy: boolean;
  consecutiveFailures: number;
  lastError: string | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  jobsCount: number;
}

export interface AuditItem {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  correlationId: string | null;
  metadata: unknown;
  createdAt: string;
}

export type WorkerActivityOutcome = 'completed' | 'skipped' | 'failed';

export interface WorkerActivityEvent {
  id: string;
  queue: string;
  jobId: string;
  jobName: string;
  outcome: WorkerActivityOutcome;
  at: string;
  durationMs: number | null;
  error: string | null;
  detail: string | null;
}

export interface ActivityResponse {
  items: WorkerActivityEvent[];
  total: number;
  hasMore: boolean;
}

export interface SettingsResponse {
  mode: string;
  generatedAt: string;
  environment: { nodeEnv: string; apiHost: string; apiPort: number; webOrigin: string };
  automation: { sourcesHealthy: number; sourcesTotal: number; clients: string[] };
  countsPresence: { applications: Record<string, number> };
}

export interface AutomationResponse {
  generatedAt: string;
  profilePresent: boolean;
  pipeline: {
    reviewMode: boolean;
    sourcesHealthy: number;
    sourcesTotal: number;
    jobsActive: number;
    matchesEligible: number;
    prepared: number;
    inProgress: number;
    inQueue: number;
    submitted: number;
    verified: number;
    failed: number;
    cancelled: number;
    rejected: number;
    blockedEvents: number;
    submissionKeyed: number;
  };
  recentBlocked: Array<{
    applicationId: string;
    jobTitle: string | null;
    company: string | null;
    eventType: string;
    stage: string | null;
    payload: unknown;
    at: string;
  }>;
}

export interface CandidateResponse {
  profile: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    emails: unknown;
    phones: unknown;
    city: string | null;
    country: string | null;
    languages: unknown;
    workAuthorization: string | null;
    remotePreferred: boolean | null;
    relocationWilling: boolean | null;
    preferredLocations: unknown;
    targetRoles: unknown;
    expectedSalaryMin: number | null;
    expectedSalaryMax: number | null;
    currency: string | null;
  };
  skills: Array<{
    id: string;
    name: string;
    category: string | null;
    level: string | null;
    years: number | null;
    lastUsedYear: number | null;
  }>;
  experience: Array<{
    organization: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    current: boolean;
  }>;
  stats: {
    skillsCount: number;
    experienceYears: number;
    experienceEntries: number;
    educationEntries: number;
    certificationCount: number;
    achievementCount: number;
    evidenceCount: number;
    materialsCount: number;
    matchesCount: number;
    matchesEligible: number;
    applicationsCount: number;
    applicationsActive: number;
  };
}

/** Shared route for moving an application between statuses. */
export function useTransitionStatus(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (to: string) =>
      apiFetch<{ application: ApplicationDetail }>(`/applications/${applicationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ to }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['automation'] });
    },
  });
}
