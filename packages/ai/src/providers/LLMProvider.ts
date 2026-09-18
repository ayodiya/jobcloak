import type { z } from 'zod';
import type {
  ChatMessage,
  ChatOptions,
  LLMProviderCapabilities,
  LLMRequest,
  LLMResponse,
  StructuredLLMRequest,
} from '../types.js';

/**
 * The single seam through which all model calls flow.
 *
 * Contract:
 * - `complete`/`chat` return model text verbatim; validation is the caller's job.
 * - `structured` returns Zod-validated output or throws `AIValidationError`.
 * - Providers never perform business logic, prompt formatting, or scoring.
 * - Model output is data and is never executed.
 */
export interface LLMProvider {
  readonly name: string;
  readonly capabilities?: LLMProviderCapabilities;
  complete(request: LLMRequest): Promise<LLMResponse>;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<LLMResponse>;
  structured<S extends z.ZodTypeAny>(request: StructuredLLMRequest<S>): Promise<z.output<S>>;
  healthCheck(): Promise<boolean>;
}
