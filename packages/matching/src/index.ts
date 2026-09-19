export { MatchingService, type LoadCandidate, type LoadJob, type MatchOutcome, type MatchingServiceDeps } from './matching-service.js';
export { MatchRepository, type MatchRow, type MatchDimensionRow, type MatchWithDimensions } from './repository.js';
export { scoreJob, type ScoreOptions } from './scorer.js';
export { deriveExperienceYears, type ExperienceSpan } from './experience.js';
export { MATCH_WEIGHTS, MATCH_DIMENSION_KEYS, assertWeightsBalanced } from './weights.js';
export type {
  CandidateView,
  DimensionResult,
  JobMatchView,
  MatchDimensionKey,
  MatchListFilter,
  MatchResult,
  MatchStatus,
} from './types.js';