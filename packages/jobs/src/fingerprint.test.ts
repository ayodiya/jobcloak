import { ValidationError } from '@jobs-app/shared';
import { describe, expect, it } from 'vitest';
import { computeFingerprint, normalizeUrl } from './fingerprint.js';

describe('normalizeUrl', () => {
  it('lowercases host, drops www, fragment and tracking params and sorts the rest', () => {
    expect(normalizeUrl('https://WWW.Example.com/Jobs/123/?utm_source=x&b=2&a=1#frag')).toBe(
      'https://example.com/Jobs/123?a=1&b=2',
    );
  });

  it('drops default ports and keeps non-default ones', () => {
    expect(normalizeUrl('https://example.com:443/jobs')).toBe('https://example.com/jobs');
    expect(normalizeUrl('http://example.com:8080/jobs')).toBe('http://example.com:8080/jobs');
  });

  it('collapses duplicate slashes and removes a trailing slash', () => {
    expect(normalizeUrl('https://example.com//a//b/')).toBe('https://example.com/a/b');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('rejects unparseable and non-http URLs', () => {
    expect(() => normalizeUrl('not a url')).toThrow(ValidationError);
    expect(() => normalizeUrl('ftp://example.com/job')).toThrow(ValidationError);
  });
});

describe('computeFingerprint', () => {
  it('is stable across tracking variants and host casing', () => {
    const a = computeFingerprint('https://www.example.com/jobs/1?utm_source=a');
    const b = computeFingerprint('https://EXAMPLE.com/jobs/1');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
  });

  it('differs for different jobs on the same host', () => {
    expect(computeFingerprint('https://example.com/jobs/1')).not.toBe(
      computeFingerprint('https://example.com/jobs/2'),
    );
  });

  it('throws for invalid URLs', () => {
    expect(() => computeFingerprint('nope')).toThrow(ValidationError);
  });
});
