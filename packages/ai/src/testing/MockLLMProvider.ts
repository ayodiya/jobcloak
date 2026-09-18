import { AIValidationError } from '@jobs-app/shared';
import type { z } from 'zod';
import { formatZodIssues, parseStructuredOutput } from '../StructuredOutputParser.js';
import type {
  ChatMessage,
  ChatOptions,
  LLMProviderCapabilities,
  LLMRequest,
  LLMResponse,
  StructuredLLMRequest,
} from '../types.js';
import type { LLMProvider } from '../providers/LLMProvider.js';

export type MockMethod = 'complete' | 'chat' | 'structured';

export interface MockCall {
  method: MockMethod;
  request: unknown;
}

export type MockResponder<T> =
  | T
  | Error
  | ((call: MockCall) => T | Error | Promise<T | Error>);

export interface MockLLMProviderOptions {
  name?: string;
  capabilities?: LLMProviderCapabilities;
  /** Single responder applies to every call; an array is consumed as a queue. */
  complete?: MockResponder<string> | MockResponder<string>[];
  chat?: MockResponder<string> | MockResponder<string>[];
  /**
   * Structured responder. A string is parsed through the request schema like a
   * real provider would; an object is validated against the schema. Returning
   * or throwing an `Error` simulates provider/validation failure.
   */
  structured?: MockResponder<unknown> | MockResponder<unknown>[];
  health?: boolean | (() => boolean | Promise<boolean>);
  /** Artificial per-call latency, in milliseconds. */
  latencyMs?: number;
}

/**
 * Deterministic in-memory `LLMProvider` for tests. No network, no model.
 *
 * Every call is recorded in `calls` so tests can assert on prompt routing.
 * Configure a queue (array) to exercise retry paths such as malformed-then-valid
 * JSON in `structured`.
 */
export class MockLLMProvider implements LLMProvider {
  readonly name: string;
  readonly capabilities: LLMProviderCapabilities;
  readonly calls: MockCall[] = [];

  private readonly completeResponses: MockResponder<string>[];
  private readonly chatResponses: MockResponder<string>[];
  private readonly structuredResponses: MockResponder<unknown>[];
  private readonly health: boolean | (() => boolean | Promise<boolean>);
  private readonly latencyMs: number;

  constructor(options: MockLLMProviderOptions = {}) {
    this.name = options.name ?? 'mock';
    this.capabilities = options.capabilities ?? { json: true, tools: false };
    this.completeResponses = toQueue(options.complete);
    this.chatResponses = toQueue(options.chat);
    this.structuredResponses = toQueue(options.structured);
    this.health = options.health ?? true;
    this.latencyMs = options.latencyMs ?? 0;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const call = this.record('complete', request);
    const text = await this.resolve(this.completeResponses, call, 'complete');
    if (text instanceof Error) throw text;
    if (typeof text !== 'string') {
      throw new AIValidationError('MockLLMProvider.complete expects a string responder');
    }
    return { text, model: request.model };
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<LLMResponse> {
    const call = this.record('chat', { messages, opts });
    const text = await this.resolve(this.chatResponses, call, 'chat');
    if (text instanceof Error) throw text;
    if (typeof text !== 'string') {
      throw new AIValidationError('MockLLMProvider.chat expects a string responder');
    }
    return { text, model: opts.model };
  }

  async structured<S extends z.ZodTypeAny>(request: StructuredLLMRequest<S>): Promise<z.output<S>> {
    const call = this.record('structured', request);
    const value = await this.resolve(this.structuredResponses, call, 'structured');
    if (value instanceof Error) throw value;
    if (typeof value === 'string') return parseStructuredOutput(value, request.schema);

    const result = request.schema.safeParse(value);
    if (!result.success) {
      throw new AIValidationError(formatZodIssues(result.error), {
        details: { issues: result.error.issues },
      });
    }
    return result.data;
  }

  async healthCheck(): Promise<boolean> {
    return typeof this.health === 'function' ? this.health() : this.health;
  }

  private record(method: MockMethod, request: unknown): MockCall {
    const call: MockCall = { method, request };
    this.calls.push(call);
    return call;
  }

  private async resolve<T>(
    queue: MockResponder<T>[],
    call: MockCall,
    label: string,
  ): Promise<T | Error> {
    if (queue.length === 0) {
      throw new AIValidationError(`MockLLMProvider has no '${label}' responder configured`);
    }
    if (this.latencyMs > 0) await delay(this.latencyMs);
    const responder = queue.length === 1 ? queue[0] : queue.shift();
    if (responder === undefined) {
      throw new AIValidationError(`MockLLMProvider exhausted '${label}' responders`);
    }
    try {
      const value =
        typeof responder === 'function'
          ? await (responder as (c: MockCall) => T | Error)(call)
          : responder;
      return value;
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }
}

function toQueue<T>(value: MockResponder<T> | MockResponder<T>[] | undefined): MockResponder<T>[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? [...value] : [value as MockResponder<T>];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
