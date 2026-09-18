import { AIValidationError } from '@jobs-app/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AIValidator } from './AIValidator.js';
import type { EvidenceDocument } from './types.js';

const evidence: EvidenceDocument[] = [
  { id: 'e1', text: 'Built a TypeScript service with PostgreSQL' },
  { id: 'e2', text: 'Led migration of the billing platform to Node.js' },
];

describe('AIValidator.extractClaims', () => {
  it('splits prose into sentence-level claims and strips bullets', () => {
    const claims = new AIValidator().extractClaims(
      '- Built a TypeScript service with PostgreSQL.\n- Managed the on-call rotation for the platform.',
    );
    expect(claims).toHaveLength(2);
    expect(claims[0]?.text).toBe('Built a TypeScript service with PostgreSQL.');
    expect(claims[1]?.text).toBe('Managed the on-call rotation for the platform.');
  });

  it('drops fragments that are too short', () => {
    expect(new AIValidator().extractClaims('Yes. No.')).toEqual([]);
  });
});

describe('AIValidator factuality gate', () => {
  it('supports claims grounded in evidence', () => {
    const check = new AIValidator().validateClaim(
      'Built a TypeScript service with PostgreSQL',
      evidence,
    );
    expect(check.supported).toBe(true);
    expect(check.evidenceIds).toEqual(['e1']);
    expect(check.score).toBeGreaterThanOrEqual(0.5);
  });

  it('flags claims with no supporting evidence', () => {
    const report = new AIValidator().checkFactuality(
      'Led the acquisition of a competing startup for 2 billion dollars.',
      evidence,
    );
    expect(report.passed).toBe(false);
    expect(report.unsupportedClaims).toHaveLength(1);
    expect(report.supportedClaims).toBe(0);
  });

  it('passes text whose claims are all supported', () => {
    const report = new AIValidator().checkFactuality(
      'Built a TypeScript service with PostgreSQL.',
      evidence,
    );
    expect(report.passed).toBe(true);
    expect(report.totalClaims).toBe(1);
    expect(report.unsupportedClaims).toEqual([]);
  });

  it('passes text with no claims', () => {
    const report = new AIValidator().checkFactuality('   ', evidence);
    expect(report.passed).toBe(true);
    expect(report.totalClaims).toBe(0);
  });
});

describe('AIValidator.validateStructured', () => {
  const schema = z.object({ name: z.string() });

  it('returns validated data', () => {
    expect(new AIValidator().validateStructured('{"name":"ok"}', schema)).toEqual({ name: 'ok' });
  });

  it('throws AIValidationError on malformed output', () => {
    expect(() => new AIValidator().validateStructured('not json', schema)).toThrow(AIValidationError);
  });
});
