import { describe, expect, it } from 'vitest';
import { deriveExperienceYears } from './experience.js';

describe('deriveExperienceYears', () => {
  it('sums sequential spans', () => {
    const years = deriveExperienceYears([
      { startDate: new Date('2020-01-01'), endDate: new Date('2022-01-01'), current: false },
      { startDate: new Date('2022-01-01'), endDate: new Date('2024-01-01'), current: false },
    ]);
    expect(years).toBeCloseTo(4, 1);
  });

  it('merges overlapping spans instead of double counting', () => {
    const years = deriveExperienceYears([
      { startDate: new Date('2020-01-01'), endDate: new Date('2023-01-01'), current: false },
      { startDate: new Date('2022-01-01'), endDate: new Date('2024-01-01'), current: false },
    ]);
    expect(years).toBeLessThan(4.1);
    expect(years).toBeGreaterThan(3.9);
  });

  it('counts a current role up to now', () => {
    const years = deriveExperienceYears(
      [{ startDate: new Date('2024-01-01'), endDate: null, current: true }],
      new Date('2026-01-01'),
    );
    expect(years).toBeCloseTo(2, 1);
  });

  it('returns zero for empty input', () => {
    expect(deriveExperienceYears([])).toBe(0);
  });
});