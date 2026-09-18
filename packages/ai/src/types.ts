import type { z } from 'zod';

/** Role of a message in a chat conversation. */
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Free-text completion request. */
export interface LLMRequest {
  prompt: string;
  model?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Shared chat/structured options. */
export interface ChatOptions {
  model?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Structured completion request. `schema` is a Zod schema; the provider must
 * return its validated output (`z.output<S>`) or throw `AIValidationError`.
 */
export interface StructuredLLMRequest<S extends z.ZodTypeAny = z.ZodTypeAny> {
  prompt: string;
  schema: S;
  model?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Verbatim model response. Providers never re-validate free text. */
export interface LLMResponse {
  text: string;
  model?: string;
  usage?: LLMUsage;
  /** Raw provider payload, for debugging/recordings. Never executed. */
  raw?: unknown;
}

/** Optional provider capabilities used by routers/callers. */
export interface LLMProviderCapabilities {
  /** Provider supports a native JSON/structured output mode. */
  json: boolean;
  /** Provider supports tool/function calling. */
  tools: boolean;
}

/** A single claim extracted from generated text for factuality checking. */
export interface Claim {
  text: string;
}

/** Minimal evidence shape accepted by the factuality gate. */
export interface EvidenceDocument {
  id: string;
  text: string;
  tags?: string[];
}

/** Result of checking one claim against the evidence base. */
export interface ClaimCheck {
  claim: string;
  supported: boolean;
  evidenceIds: string[];
  score: number;
}

/** Aggregate factuality report for a piece of generated text. */
export interface FactualityReport {
  totalClaims: number;
  supportedClaims: number;
  unsupportedClaims: ClaimCheck[];
  checks: ClaimCheck[];
  passed: boolean;
}
