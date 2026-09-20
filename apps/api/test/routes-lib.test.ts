import { describe, expect, it } from 'vitest';
import {
  parseListQuery,
  parseSort,
  csv,
  toBoolean,
  clampInt,
  paginate,
} from '../src/routes/lib.js';

describe('parseListQuery', () => {
  it('applies defaults when nothing is provided', () => {
    expect(parseListQuery({})).toEqual({ search: undefined, limit: 20, offset: 0 });
  });

  it('parses page/limit/search and caps the page at MAX_LIMIT', () => {
    const parsed = parseListQuery({ page: '3', limit: '500', search: '  Senior  ' });
    expect(parsed).toEqual({ search: 'Senior', limit: 100, offset: 200 });
  });

  it('collapses a string-array query value to its first element', () => {
    expect(parseListQuery({ search: ['first', 'second'] as unknown as string }).search).toBe('first');
  });

  it('falls back to defaults on garbage input', () => {
    expect(parseListQuery({ page: 'not-a-number', limit: '-4' })).toEqual({ search: undefined, limit: 20, offset: 0 });
  });
});

describe('parseSort', () => {
  it('splits a leading dash into a descending direction', () => {
    expect(parseSort('-totalScore', 'discoveredAt')).toEqual({ field: 'totalScore', dir: 'desc' });
    expect(parseSort('title', 'discoveredAt')).toEqual({ field: 'title', dir: 'asc' });
  });

  it('falls back to the default field', () => {
    expect(parseSort(undefined, 'discoveredAt')).toEqual({ field: 'discoveredAt', dir: 'asc' });
  });
});

describe('csv / toBoolean / clampInt', () => {
  it('parses comma-separated values and de-duplicates them', () => {
    expect(csv('a, b, a')).toEqual(['a', 'b']);
    expect(csv(undefined)).toEqual([]);
  });

  it('parses common boolean spellings and returns the fallback for junk', () => {
    expect(toBoolean('true')).toBe(true);
    expect(toBoolean('FALSE')).toBe(false);
    expect(toBoolean('garbage')).toBe(false);
    expect(toBoolean(undefined, true)).toBe(true);
  });

  it('clamps integers into the allowed range', () => {
    expect(clampInt('150', 20, 1, 100)).toBe(100);
    expect(clampInt('0', 2, 1, 100)).toBe(1);
    expect(clampInt('banana', 5, 1, 100)).toBe(5);
  });
});

describe('paginate', () => {
  it('clips a page to the available data', () => {
    expect(paginate([], 25, 3, 10)).toEqual({ items: [], total: 25, page: 3, limit: 10, hasMore: false });
  });
});
