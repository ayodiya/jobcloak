import { describe, expect, it } from 'vitest';
import { MATCH_WEIGHTS, MATCH_DIMENSION_KEYS, assertWeightsBalanced } from './weights.js';

describe('match weights', () => {
  it('sums to 100', () => {
    const total = Object.values(MATCH_WEIGHTS).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(100);
  });

  it('covers all seven dimensions', () => {
    expect(MATCH_DIMENSION_KEYS.sort()).toEqual(
      ['tech', 'experience', 'seniority', 'role', 'location', 'domain', 'salary'].sort(),
    );
  });

  it('accepts a balanced weight set and rejects unbalanced ones', () => {
    expect(() => assertWeightsBalanced(MATCH_WEIGHTS)).not.toThrow();
    expect(() => assertWeightsBalanced({ ...MATCH_WEIGHTS, tech: 31 })).toThrow('sum to 100');
  });
});