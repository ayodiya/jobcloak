import { describe, expect, it } from 'vitest';
import type { PageSnapshot } from './types.js';
import { verifySubmission } from './verify.js';

function snapshot(
  bodyText: string,
  url = 'https://careers.example.com/apply',
  title = '',
): PageSnapshot {
  return {
    url,
    html: `<html><head><title>${title}</title></head><body>${bodyText}</body></html>`,
    title,
    bodyText,
  };
}

describe('verifySubmission', () => {
  it('marks a success page as verified', () => {
    const result = verifySubmission(
      snapshot('Thank you for applying. Your application has been submitted.'),
    );
    expect(result.status).toBe('verified');
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('marks a thank-you URL as verified even without body markers', () => {
    const result = verifySubmission(
      snapshot('We received your application.', 'https://jobs.example.com/apply/thank-you'),
    );
    expect(result.status).toBe('verified');
  });

  it('marks a validation-failure page as failed', () => {
    const result = verifySubmission(
      snapshot('An error occurred. Please correct the following information:'),
    );
    expect(result.status).toBe('failed');
  });

  it('returns pending when success and failure markers both appear', () => {
    const result = verifySubmission(
      snapshot('There was a problem with your application. Thank you for your interest.'),
    );
    expect(result.status).toBe('pending');
  });

  it('returns inconclusive on an unmatched page', () => {
    const result = verifySubmission(snapshot('Loading...'));
    expect(result.status).toBe('inconclusive');
    expect(result.evidence).toEqual([]);
  });
});
