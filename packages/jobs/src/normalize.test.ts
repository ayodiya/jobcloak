import { ValidationError } from '@jobs-app/shared';
import { describe, expect, it } from 'vitest';
import {
  detectRemote,
  normalizeJob,
  parseJob,
  parseSalary,
  toPlainText,
} from './normalize.js';

describe('toPlainText', () => {
  it('strips HTML and decodes common entities while keeping tags-close as line breaks', () => {
    const text = toPlainText('<p>Hello</p><p>World &amp; more</p><script>evil()</script>');
    expect(text).toContain('Hello');
    expect(text).toContain('World & more');
    expect(text).toContain('\n');
    expect(text).not.toContain('evil');
    expect(text).not.toContain('<p>');
  });
});

describe('detectRemote', () => {
  it('detects remote markers in location and description', () => {
    expect(detectRemote('Remote - EU')).toBe(true);
    expect(detectRemote('Berlin, Germany', 'hybrid onsite preferred')).toBe(false);
    expect(detectRemote('Berlin', 'We are a distributed team hiring anywhere')).toBe(true);
    expect(detectRemote(undefined, 'Work from home')).toBe(true);
  });
});

describe('parseSalary', () => {
  it('parses dollar ranges with commas', () => {
    expect(parseSalary('Salary: $120,000 - $150,000')).toEqual({
      min: 120000,
      max: 150000,
      currency: 'USD',
    });
  });

  it('parses UK-style k ranges', () => {
    expect(parseSalary('£80k–£95k')).toEqual({ min: 80000, max: 95000, currency: 'GBP' });
  });

  it('returns undefined for listings without a range', () => {
    expect(parseSalary('Competitive salary')).toBeUndefined();
  });
});

describe('parseJob', () => {
  it('accepts valid payloads and fills a default description', () => {
    const job = parseJob({
      sourceName: 'fixture',
      url: 'https://example.com/jobs/1',
      title: 'Senior Engineer',
      company: 'Acme',
    });
    expect(job.description).toBe('');
  });

  it('rejects payloads missing required fields', () => {
    expect(() =>
      parseJob({ sourceName: 'fixture', url: 'https://x.example/j/1', company: 'Acme' }),
    ).toThrow(ValidationError);
  });
});

describe('normalizeJob', () => {
  const input = {
    sourceName: 'fixture',
    url: 'https://www.Acme.test/jobs/42?utm_source=mail',
    title: '  Senior  Engineer  ',
    company: '  Acme Inc  ',
    description: '<p>Remote work. Salary $100,000 - $120,000.</p>',
  };

  it('derives fingerprint, canonical URL, remote flag and salary', () => {
    const job = normalizeJob(parseJob(input));
    expect(job.title).toBe('Senior Engineer');
    expect(job.remote).toBe(true);
    expect(job.normalizedUrl).toBe('https://acme.test/jobs/42');
    expect(job.fingerprint).toMatch(/^[0-9a-f]{40}$/);
    expect(job.salaryMin).toBe(100000);
    expect(job.salaryMax).toBe(120000);
  });
});