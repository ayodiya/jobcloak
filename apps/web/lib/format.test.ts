import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatSalary, scorePercent } from './format';

describe('formatDate', () => {
  it('returns an em dash for missing values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('renders a date with the year and month', () => {
    const value = formatDate('2026-07-20T00:00:00.000Z');
    expect(value).toContain('2026');
    expect(value).not.toContain('—');
  });
});

describe('formatDateTime', () => {
  it('returns an em dash for missing values', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('renders a date-time with year and time components', () => {
    const value = formatDateTime('2026-08-05T08:00:00.000Z');
    expect(value).toContain('2026');
    expect(value).toMatch(/[0-9]{1,2}:/);
  });
});

describe('formatSalary', () => {
  it('returns an em dash when no range is known', () => {
    expect(formatSalary(null, null, null)).toBe('—');
  });

  it('renders a range with an en dash separator', () => {
    expect(formatSalary(95_000, 125_000, 'EUR')).toContain('–');
  });

  it('renders a floor with a trailing plus', () => {
    expect(formatSalary(95_000, null, 'USD')).toMatch(/\+$/);
  });

  it('renders a cap with an up-to prefix', () => {
    expect(formatSalary(null, 125_000, null)).toMatch(/^up to /);
  });
});

describe('scorePercent', () => {
  it('converts 0..1 scores to whole percentages', () => {
    expect(scorePercent(0.5)).toBe('50%');
    expect(scorePercent(0.592)).toBe('59%');
    expect(scorePercent(1)).toBe('100%');
  });
});