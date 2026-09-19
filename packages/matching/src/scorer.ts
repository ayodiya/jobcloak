/**
 * Deterministic, explanatory match scoring (see discovery-and-matching.md).
 * Scores candidates against jobs dimension-by-dimension, applies hard
 * disqualifiers, and estimates confidence from how much evidence supported
 * each dimension. Pure — no I/O, no AI.
 */
import {
  SENIORITY_ORDER,
  candidateAuthorizationStatus,
  clamp01,
  detectDomains,
  inferSeniority,
  requiresAuthorization,
  roleKeywords,
  round2,
} from './lexicon.js';
import { ValidationError } from '@jobs-app/shared';
import type {
  CandidateView,
  DimensionResult,
  JobMatchView,
  MatchDimensionKey,
  MatchResult,
  MatchStatus,
} from './types.js';
import { MATCH_WEIGHTS, MATCH_DIMENSION_KEYS, assertWeightsBalanced } from './weights.js';

const SKILL_KIND_WEIGHT: Record<'Required' | 'Preferred' | 'NiceToHave', number> = {
  Required: 1,
  Preferred: 0.5,
  NiceToHave: 0.25,
};

const REQUIREMENT_KINDS = new Set(['Required', 'Preferred', 'NiceToHave']);
const REQUIREMENT_CATEGORIES = new Set(['Skill', 'Experience', 'Education', 'Certification', 'Language', 'Other']);

export interface ScoreOptions {
  weights?: Record<MatchDimensionKey, number>;
}

export function scoreJob(candidate: CandidateView, job: JobMatchView, options: ScoreOptions = {}): MatchResult {
  const weights = options.weights ?? MATCH_WEIGHTS;
  validateWeights(weights);
  validateJobView(job);

  const dimensions = {
    tech: scoreTech(candidate, job),
    experience: scoreExperience(candidate, job),
    seniority: scoreSeniority(candidate, job),
    role: scoreRole(candidate, job),
    location: scoreLocation(candidate, job),
    domain: scoreDomain(candidate, job),
    salary: scoreSalary(candidate, job),
  };

  const disqualifiers = collectDisqualifiers(candidate, job);
  const eligible = disqualifiers.length === 0;

  const applicable = MATCH_DIMENSION_KEYS.filter((key) => dimensions[key].applicable);
  const weightedSum = applicable.reduce((sum, key) => sum + weights[key] * dimensions[key].score, 0);
  const weightSum = applicable.reduce((sum, key) => sum + weights[key], 0);
  const totalScore = round2(weightSum > 0 ? weightedSum / weightSum : 0);
  const confidence = computeConfidence(candidate, job, dimensions);

  return {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    totalScore,
    eligible,
    disqualifiers,
    confidence,
    dimensions,
  };
}

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

function scoreTech(candidate: CandidateView, job: JobMatchView): DimensionResult {
  const requirements = job.requirements.filter((req) => req.category === 'Skill');
  if (requirements.length === 0) {
    return notApplicable(
      'tech',
      'No skill requirements extracted from the listing',
    );
  }

  const candidateKeys = new Set(candidate.skills.map(skillKey));
  const weighted = requirements.map((req) => ({ req, weight: SKILL_KIND_WEIGHT[req.kind] }));
  const weightSum = weighted.reduce((sum, entry) => sum + entry.weight, 0);

  const matched: string[] = [];
  const missing: string[] = [];
  let gained = 0;
  for (const { req, weight } of weighted) {
    if (candidateKeys.has(skillKeyOf(req.key, req.name))) {
      gained += weight;
      matched.push(req.name);
    } else if (req.kind === 'Required') {
      missing.push(req.name);
    }
  }

  const score = clamp01(gained / weightSum);
  const evidence = [
    ...(matched.length > 0 ? [`Matched skills: ${[...new Set(matched)].join(', ')}`] : []),
    ...(missing.length > 0 ? [`Missing required skills: ${[...new Set(missing)].join(', ')}`] : []),
    `${requirements.length} skills requested`,
  ];
  return dimension('tech', score, true, matched.length >= requirements.length, evidence);
}

function scoreExperience(candidate: CandidateView, job: JobMatchView): DimensionResult {
  const requirements = job.requirements.filter(
    (req) => req.category === 'Experience' && req.minYears !== null && req.minYears !== undefined,
  );
  if (requirements.length === 0) {
    return notApplicable('experience', 'No experience years required by the listing');
  }

  const years = candidate.experienceYears;
  const weighted = requirements.map((req) => ({ req, weight: SKILL_KIND_WEIGHT[req.kind] }));
  const weightSum = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let gained = 0;
  let samples = 0;
  for (const { req, weight } of weighted) {
    const minYears = req.minYears ?? 0;
    if (minYears > 0) samples += 1;
    gained += weight * clamp01(minYears > 0 ? years / minYears : 1);
  }

  if (years <= 0) {
    const detail = 'No experience entries in the candidate profile';
    return dimension('experience', 0, true, false, [detail, ...requirements.map((r) => `${r.name}`)]);
  }

  const score = clamp01(gained / weightSum);
  const evidence = [
    `Candidate has ~${round2(years)}y across ${samples} year requirement${samples === 1 ? '' : 's'}`,
    ...requirements.map((r) => `${r.kind.toLowerCase()} ${r.minYears ?? 0}+y (${years >= (r.minYears ?? 0) ? 'met' : 'short'})`),
  ];
  return dimension('experience', score, true, score >= 0.9, evidence);
}

function scoreSeniority(candidate: CandidateView, job: JobMatchView): DimensionResult {
  const jobLevel = inferSeniority(`${job.title} ${job.seniority ?? ''}`);
  if (!jobLevel.level) {
    return notApplicable('seniority', 'No seniority signal in the listing title');
  }

  const candidateLevel = inferSeniority(candidate.title ?? '');
  if (!candidateLevel.level) {
    return dimension('seniority', 0.35, true, false, [
      'Candidate seniority not stated explicitly in profile title',
      `Job level: ${jobLevel.level}`,
    ]);
  }

  const jobIdx = SENIORITY_ORDER.indexOf(jobLevel.level);
  const candIdx = SENIORITY_ORDER.indexOf(candidateLevel.level);
  const distance = Math.abs(jobIdx - candIdx);
  const score = distance === 0 ? 1 : distance === 1 ? 0.6 : distance === 2 ? 0.3 : 0;

  return dimension('seniority', score, true, distance === 0, [
    `Job: ${jobLevel.level} · Candidate: ${candidateLevel.level}`,
    distance === 0 ? 'Levels match' : `Levels differ by ${distance} band(s)`,
  ]);
}

function scoreRole(candidate: CandidateView, job: JobMatchView): DimensionResult {
  const jobTokens = roleKeywords(job.title);
  if (jobTokens.length === 0) {
    return notApplicable('role', 'No role keywords in the listing title');
  }
  const candidateTokens = new Set(roleKeywords(candidate.title, ...(candidate.targetRoles ?? [])));
  const matched = jobTokens.filter((token) => candidateTokens.has(token));
  const score = clamp01(matched.length / jobTokens.length);
  const evidence = [
    `Job role: ${jobTokens.join(', ')}`,
    matched.length > 0 ? `Matched: ${matched.join(', ')}` : `No overlap with candidate roles`,
  ];
  return dimension('role', score, true, matched.length === jobTokens.length, evidence);
}

function scoreLocation(candidate: CandidateView, job: JobMatchView): DimensionResult {
  if (job.remote) {
    if (candidate.remotePreferred === false) {
      return dimension('location', 0, true, false, ['Job is remote but candidate prefers on-site work']);
    }
    return dimension('location', 1, true, true, ['Job is remote; candidate is open to remote']);
  }

  if (!job.location) {
    return notApplicable('location', 'Job location is not disclosed and the role is on-site');
  }

  const places = (candidate.preferredLocations ?? []).map(locationKey);
  const jobPlace = locationKey(job.location);
  if (places.length === 0) {
    return dimension('location', 0.5, true, false, ['No preferred locations set on the candidate']);
  }
  const matched = places.find((place) => place.length > 0 && place !== 'remote' && (jobPlace === place || jobPlace.includes(place) || place.includes(jobPlace)));
  if (matched) {
    return dimension('location', 1, true, true, [`Location (${job.location}) is in candidate preferences`]);
  }
  if (candidate.relocationWilling === true) {
    return dimension('location', 0.6, true, false, ['Candidate is willing to relocate']);
  }
  return dimension('location', 0, true, false, [`Job location (${job.location}) not in candidate preferences`]);
}

function scoreDomain(candidate: CandidateView, job: JobMatchView): DimensionResult {
  const jobDomains = detectDomains(`${job.title} ${job.description}`);
  if (jobDomains.length === 0) {
    return notApplicable('domain', 'No industry domain signals in the listing');
  }
  const candidateDomains = new Set(detectDomains(candidate.backgroundText));
  const matched = jobDomains.filter((domain) => candidateDomains.has(domain));
  const score = clamp01(matched.length / jobDomains.length);
  const evidence = [
    `Job domains: ${jobDomains.join(', ')}`,
    matched.length > 0 ? `Candidate overlap: ${matched.join(', ')}` : 'No candidate domain overlap',
  ];
  return dimension('domain', score, true, matched.length === jobDomains.length, evidence);
}

function scoreSalary(candidate: CandidateView, job: JobMatchView): DimensionResult {
  const jobMin = job.salaryMin ?? null;
  const jobMax = job.salaryMax ?? jobMin;
  if (jobMin === null && jobMax === null) {
    return notApplicable('salary', 'Listing does not disclose salary');
  }

  const expMin = candidate.expectedSalaryMin ?? null;
  const expMax = candidate.expectedSalaryMax ?? candidate.expectedSalaryMin;
  if (expMin === null && expMax === null) {
    return notApplicable('salary', 'Candidate has no salary expectation set');
  }

  const jobCurrency = job.salaryCurrency ? job.salaryCurrency.toUpperCase() : undefined;
  const candCurrency = candidate.currency ? candidate.currency.toUpperCase() : undefined;
  if (candCurrency && jobCurrency && candCurrency !== jobCurrency) {
    return notApplicable('salary', `Currency mismatch (job ${jobCurrency}, candidate ${candCurrency})`);
  }

  const jLo = jobMin ?? jobMax ?? 0;
  const jHi = jobMax ?? jobMin ?? 0;
  const cLo = expMin ?? expMax ?? 0;
  const cHi = expMax ?? expMin ?? 0;

  let score: number;
  if (cHi > cLo) {
    const overlap = Math.min(jHi, cHi) - Math.max(jLo, cLo);
    score = clamp01(overlap / (cHi - cLo));
  } else {
    score = clamp01(jHi >= cLo ? 1 : (cHi > 0 ? jHi / cHi : 0));
  }

  const scoreAboveMin = jHi >= cLo;
  // NOTE: the candidate range below is duplicated into match evidence for
  // explainability. It is candidate-derived PII — keep it out of any future
  // non-local export path (see security review, Phase 5).
  const evidence = [
    `Job range ${formatMoney(jLo)}–${formatMoney(jHi)}${jobCurrency ? ` ${jobCurrency}` : ''}`,
    `Candidate range ${formatMoney(cLo)}–${formatMoney(cHi)}${candCurrency ? ` ${candCurrency}` : ''}`,
    scoreAboveMin ? 'Advertised max meets the candidate minimum' : 'Advertised max below candidate minimum',
  ];
  return dimension('salary', score, true, score >= 1, evidence);
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function validateWeights(weights: Record<MatchDimensionKey, number>): void {
  assertWeightsBalanced(weights);
  const invalid = MATCH_DIMENSION_KEYS.some((key) => !Number.isFinite(weights[key]) || weights[key] < 0);
  if (invalid) throw new ValidationError('Match weights must be finite and non-negative');
}

function validateJobView(job: JobMatchView): void {
  for (const requirement of job.requirements) {
    if (!REQUIREMENT_KINDS.has(requirement.kind)) {
      throw new ValidationError(`Unsupported requirement kind: ${requirement.kind}`);
    }
    if (!REQUIREMENT_CATEGORIES.has(requirement.category)) {
      throw new ValidationError(`Unsupported requirement category: ${requirement.category}`);
    }
    if (!requirement.name || requirement.name.trim().length === 0) {
      throw new ValidationError(`Requirement ${requirement.category}/${requirement.key} has no name`);
    }
    if (requirement.minYears !== null && requirement.minYears !== undefined) {
      if (!Number.isInteger(requirement.minYears) || requirement.minYears < 0) {
        throw new ValidationError(`Requirement ${requirement.name} has invalid minYears`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Hard filters & confidence
// ---------------------------------------------------------------------------

function collectDisqualifiers(candidate: CandidateView, job: JobMatchView): string[] {
  const disqualifiers: string[] = [];

  const listingText = `${job.title} ${job.description}`;
  if (requiresAuthorization(listingText)) {
    const status = candidateAuthorizationStatus(candidate.workAuthorization, candidate.visaStatus);
    if (!status.unknown && !status.authorized) {
      disqualifiers.push('work-authorization: listing requires authorization the candidate does not evidence');
    }
  }

  for (const req of job.requirements) {
    const minYears = req.minYears;
    if (req.category !== 'Experience' || minYears === null || minYears === undefined) continue;
    if (req.kind === 'Required' && minYears >= 8) {
      if (candidate.experienceYears > 0 && candidate.experienceYears < minYears / 2) {
        disqualifiers.push(`required-experience: ${minYears}+ years required, candidate has ~${candidate.experienceYears}y`);
      }
    }
  }

  return disqualifiers;
}

function computeConfidence(
  candidate: CandidateView,
  job: JobMatchView,
  dimensions: Record<MatchDimensionKey, DimensionResult>,
): number {
  let confidence = 1;
  if (job.requirements.some((req) => req.source === 'AI')) confidence -= 0.15;
  if (job.description.length < 300) confidence -= 0.1;
  if (job.salaryMin === null && job.salaryMax === null && candidate.expectedSalaryMin !== null) confidence -= 0.05;
  if (candidate.skills.length < 4) confidence -= 0.1;
  const expRequired = job.requirements.some((req) => req.category === 'Experience' && req.minYears !== null);
  if (expRequired && candidate.experienceYears <= 0) confidence -= 0.1;
  const applicableCount = MATCH_DIMENSION_KEYS.filter((key) => dimensions[key].applicable).length;
  if (applicableCount < 4) confidence -= 0.1;
  return round2(clamp01(confidence));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dimension(
  key: MatchDimensionKey,
  score: number,
  applicable: boolean,
  fullyMatched: boolean,
  evidence: string[],
): DimensionResult {
  const status: MatchStatus = applicable ? (score >= 1 || fullyMatched ? 'matched' : score > 0 ? 'partial' : 'missing') : 'not-applicable';
  const detail =
    status === 'matched'
      ? 'Fully matched'
      : status === 'partial'
        ? 'Partially matched'
        : status === 'missing'
          ? 'No match'
          : 'Not applicable';
  return {
    key,
    weight: MATCH_WEIGHTS[key],
    score: round2(score),
    applicable,
    status,
    detail,
    evidence,
  };
}

function notApplicable(key: MatchDimensionKey, detail: string): DimensionResult {
  return { key, weight: MATCH_WEIGHTS[key], score: 0, applicable: false, status: 'not-applicable', detail, evidence: [] };
}

function skillKeyOf(key: string, name: string): string {
  const fallback = name.toLowerCase().replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return key.toLowerCase().trim() || fallback;
}

function skillKey(skill: CandidateView['skills'][number]): string {
  return skillKeyOf(skill.key, skill.name);
}

function locationKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#. ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US');
}

export { deriveExperienceYears } from './experience.js';