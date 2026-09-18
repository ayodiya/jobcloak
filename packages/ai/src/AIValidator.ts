import type { z } from 'zod';
import { EvidenceRetriever } from './EvidenceRetriever.js';
import { parseStructuredOutput } from './StructuredOutputParser.js';
import type { Claim, ClaimCheck, EvidenceDocument, FactualityReport } from './types.js';

export interface AIValidatorOptions {
  retriever?: EvidenceRetriever;
  /** Minimum evidence-match score (0..1) required to consider a claim supported. */
  minClaimSupport?: number;
}

const DEFAULT_MIN_CLAIM_SUPPORT = 0.5;
const MIN_CLAIM_LENGTH = 12;

/**
 * Mechanical gates applied to model output before it can be trusted.
 *
 * Two responsibilities:
 * 1. Structured output must satisfy its Zod schema (`validateStructured`).
 * 2. Generated prose must be grounded in the candidate evidence base — every
 *    claim is checked against evidence and unsupported claims are surfaced for
 *    regenerate/review (ADR-0005). Claim extraction here is a deterministic
 *    sentence heuristic; the Phase 6 generator may replace extraction with an
 *    LLM step while reusing this checker.
 */
export class AIValidator {
  private readonly retriever: EvidenceRetriever;
  private readonly minClaimSupport: number;

  constructor(options: AIValidatorOptions = {}) {
    this.retriever = options.retriever ?? new EvidenceRetriever();
    this.minClaimSupport = options.minClaimSupport ?? DEFAULT_MIN_CLAIM_SUPPORT;
  }

  /** Validate model text against a schema; throws `AIValidationError` on failure. */
  validateStructured<S extends z.ZodTypeAny>(text: string, schema: S): z.output<S> {
    return parseStructuredOutput(text, schema);
  }

  /** Deterministic sentence-level claim extraction. */
  extractClaims(text: string): Claim[] {
    return text
      .replace(/\r\n/g, '\n')
      .split(/(?<=[.!?])\s+|\n+/)
      .map((part) => part.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
      .filter((part) => part.length >= MIN_CLAIM_LENGTH && /[a-z]/i.test(part))
      .map((claim) => ({ text: claim }));
  }

  validateClaim(claim: string, evidence: EvidenceDocument[]): ClaimCheck {
    const matches = this.retriever.retrieve(claim, evidence);
    const supporting = matches.filter((match) => match.score >= this.minClaimSupport);
    const top = supporting[0];
    return {
      claim,
      supported: supporting.length > 0,
      evidenceIds: supporting.map((match) => match.id),
      score: top?.score ?? 0,
    };
  }

  validateClaims(claims: Claim[], evidence: EvidenceDocument[]): ClaimCheck[] {
    return claims.map((claim) => this.validateClaim(claim.text, evidence));
  }

  /**
   * Check generated text end-to-end. `passed` means no unsupported claims were
   * found; text with no claims at all trivially passes (nothing fabricated).
   */
  checkFactuality(text: string, evidence: EvidenceDocument[]): FactualityReport {
    const checks = this.validateClaims(this.extractClaims(text), evidence);
    const unsupportedClaims = checks.filter((check) => !check.supported);
    return {
      totalClaims: checks.length,
      supportedClaims: checks.length - unsupportedClaims.length,
      unsupportedClaims,
      checks,
      passed: unsupportedClaims.length === 0,
    };
  }
}
