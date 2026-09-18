import { AIProviderError, AIValidationError } from '@jobs-app/shared';
import type { z } from 'zod';
import {
  buildJsonCorrectionMessage,
  parseStructuredOutput,
} from '../StructuredOutputParser.js';
import type {
  ChatMessage,
  ChatOptions,
  LLMRequest,
  LLMResponse,
  LLMUsage,
  StructuredLLMRequest,
} from '../types.js';
import type { LLMProvider } from './LLMProvider.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5-coder:3b';
const DEFAULT_TIMEOUT_MS = 120_000;

export interface OllamaProviderOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  /** Injectable fetch for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface OllamaChatResponse {
  model?: string;
  message?: { role?: string; content?: string };
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Reference `LLMProvider` backed by a local Ollama server (ADR-0002).
 *
 * Privacy: requests go only to the configured local base URL; no hosted
 * fallback exists in this provider.
 */
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly capabilities = { json: true, tools: false };

  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.defaultModel = options.model ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const body = {
      model: request.model ?? this.defaultModel,
      prompt: request.prompt,
      ...(request.system !== undefined ? { system: request.system } : {}),
      stream: false,
      options: this.mapOptions(request),
    };

    const payload = await this.post<OllamaChatResponse>('/api/generate', body);
    return {
      text: payload.response ?? '',
      model: payload.model ?? body.model,
      usage: toUsage(payload),
      raw: payload,
    };
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<LLMResponse> {
    const body = {
      model: opts.model ?? this.defaultModel,
      messages: withSystem(messages, opts.system),
      stream: false,
      options: this.mapOptions(opts),
    };

    const payload = await this.post<OllamaChatResponse>('/api/chat', body);
    return {
      text: payload.message?.content ?? '',
      model: payload.model ?? body.model,
      usage: toUsage(payload),
      raw: payload,
    };
  }

  async structured<S extends z.ZodTypeAny>(request: StructuredLLMRequest<S>): Promise<z.output<S>> {
    const model = request.model ?? this.defaultModel;
    const baseMessages: ChatMessage[] = [
      ...(request.system !== undefined ? [{ role: 'system' as const, content: request.system }] : []),
      { role: 'user', content: request.prompt },
    ];

    const first = await this.chatJson(model, baseMessages, request);
    try {
      return parseStructuredOutput(first.text, request.schema);
    } catch (error) {
      if (!(error instanceof AIValidationError)) throw error;

      // One corrective retry: replay the invalid output and ask for a repair.
      const retryMessages: ChatMessage[] = [
        ...baseMessages,
        { role: 'assistant', content: first.text },
        { role: 'user', content: buildJsonCorrectionMessage(first.text, error.message) },
      ];
      const second = await this.chatJson(model, retryMessages, request);
      return parseStructuredOutput(second.text, request.schema);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('/api/version', { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private mapOptions(input: { temperature?: number; maxTokens?: number }): Record<string, unknown> {
    const options: Record<string, unknown> = {};
    if (input.temperature !== undefined) options['temperature'] = input.temperature;
    if (input.maxTokens !== undefined) options['num_predict'] = input.maxTokens;
    return options;
  }

  private chatJson(
    model: string,
    messages: ChatMessage[],
    request: { temperature?: number; maxTokens?: number },
  ): Promise<LLMResponse> {
    return this.post<OllamaChatResponse>('/api/chat', {
      model,
      messages,
      stream: false,
      format: 'json',
      options: this.mapOptions(request),
    }).then((payload) => ({
      text: payload.message?.content ?? '',
      model: payload.model ?? model,
      usage: toUsage(payload),
      raw: payload,
    }));
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await safeText(response);
      throw new AIProviderError(`Ollama responded ${response.status} for ${path}`, {
        details: { status: response.status, path, body: preview(detail) },
      });
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new AIProviderError(`Ollama returned invalid JSON for ${path}`, {
        cause: error,
        details: { path },
      });
    }
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
    } catch (error) {
      if (isAbortError(error)) {
        throw new AIProviderError(
          `Ollama request to ${path} timed out after ${this.timeoutMs}ms`,
          { cause: error, details: { path, timeoutMs: this.timeoutMs } },
        );
      }
      throw new AIProviderError(`Failed to reach Ollama at ${this.baseUrl}${path}`, {
        cause: error,
        details: { path },
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

function withSystem(messages: ChatMessage[], system?: string): ChatMessage[] {
  if (system === undefined) return messages;
  return [{ role: 'system', content: system }, ...messages];
}

function toUsage(payload: OllamaChatResponse): LLMUsage | undefined {
  const promptTokens = payload.prompt_eval_count;
  const completionTokens = payload.eval_count;
  if (promptTokens === undefined && completionTokens === undefined) return undefined;
  return {
    promptTokens,
    completionTokens,
    totalTokens: (promptTokens ?? 0) + (completionTokens ?? 0),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function preview(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
