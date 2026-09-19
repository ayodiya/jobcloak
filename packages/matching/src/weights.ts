import type { MatchDimensionKey } from './types.js';

/**
 * Weight of each matching dimension (sums to 100). From the architecture doc
 * (discovery-and-matching.md §Matching): technical match 30, experience 20,
 * seniority 15, role 15, location 10, domain 5, salary 5.
 */
export const MATCH_WEIGHTS: Record<MatchDimensionKey, number> = {
  tech: 30,
  experience: 20,
  seniority: 15,
  role: 15,
  location: 10,
  domain: 5,
  salary: 5,
};

export const MATCH_DIMENSION_KEYS = Object.keys(MATCH_WEIGHTS) as MatchDimensionKey[];

export function assertWeightsBalanced(weights: Record<MatchDimensionKey, number> = MATCH_WEIGHTS): void {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total !== 100) {
    throw new Error(`Match weights must sum to 100, got ${total}`);
  }
}