import { readFile, writeFile } from 'node:fs/promises';
import { AIProviderError, AIValidationError, InternalError } from '@jobs-app/shared';
import type { z } from 'zod';
import { formatZodIssues, parseStructuredOutput } from '../StructuredOutputParser.js';
import type {
  ChatMessage,
  ChatOptions,
  LLMRequest,
  LLMResponse,
  LLMProviderCapabilities,
  StructuredLLMRequest,
} from '../types.js';
import type { LLMProvider } from '../providers/LLMProvider.js';
import type { MockMethod } from './MockLLMProvider.js';

export interface RecordingEntry {
  method: MockMethod;
  request: unknown;
  response?: unknown;
  error?: { name: string; message: string };
}

export interface LLMRecording {
  version: 1;
  provider: string;
  createdAt: string;
  entries: RecordingEntry[];
}

export interface RecordingLLMProviderOptions {
  name?: string;
  /** Overrides the recording timestamp (useful for stable fixtures). */
  createdAt?: string;
}

/**
 * Wraps a real provider to record calls, or replays a recording.
 *
 * Recordings keep tests hermetic while locking in real model behavior for
 * scenarios that matter (requirement extraction, claim classification). The
 * `structured` request schema is never serialized — only the prompt/options —
 * and replayed output is validated against the caller's schema again.
 */
export class RecordingLLMProvider implements LLMProvider {
  readonly name: string;
  readonly capabilities?: LLMProviderCapabilities;

  private readonly delegate?: LLMProvider;
  private readonly replay?: RecordingEntry[];
  private readonly recorded: RecordingEntry[] = [];
  private replayCursor = 0;
  private readonly createdAt: string;

  private constructor(
    readonly mode: 'recording' | 'replaying',
    delegateOrEntries: LLMProvider | RecordingEntry[],
    options: RecordingLLMProviderOptions = {},
  ) {
    if (mode === 'recording') {
      this.delegate = delegateOrEntries as LLMProvider;
      this.name = options.name ?? `${this.delegate.name}-recording`;
      this.capabilities = this.delegate.capabilities;
    } else {
      this.replay = delegateOrEntries as RecordingEntry[];
      this.name = options.name ?? 'recording-replay';
    }
    this.createdAt = options.createdAt ?? new Date().toISOString();
  }

  static recording(delegate: LLMProvider, options?: RecordingLLMProviderOptions): RecordingLLMProvider {
    return new RecordingLLMProvider('recording', delegate, options);
  }

  static replaying(recording: LLMRecording, options?: RecordingLLMProviderOptions): RecordingLLMProvider {
    return new RecordingLLMProvider('replaying', [...recording.entries], {
      ...options,
      name: options?.name ?? `${recording.provider}-replay`,
      createdAt: recording.createdAt,
    });
  }

  get recording(): LLMRecording {
    return {
      version: 1,
      provider: this.delegate?.name ?? this.name,
      createdAt: this.createdAt,
      entries: this.recorded,
    };
  }

  toJSON(): LLMRecording {
    return this.recording;
  }

  async save(path: string): Promise<void> {
    await writeFile(path, `${JSON.stringify(this.recording, null, 2)}\n`, 'utf-8');
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    return this.invoke('complete', request, async (delegate) => delegate.complete(request));
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<LLMResponse> {
    const request = { messages, opts };
    return this.invoke('chat', request, async (delegate) => delegate.chat(messages, opts));
  }

  async structured<S extends z.ZodTypeAny>(request: StructuredLLMRequest<S>): Promise<z.output<S>> {
    const recordedRequest = { ...request, schema: undefined };
    if (this.mode === 'recording') {
      const delegate = this.requireDelegate();
      try {
        const result = await delegate.structured(request);
        this.recorded.push({ method: 'structured', request: recordedRequest, response: result });
        return result;
      } catch (error) {
        this.recordFailure('structured', recordedRequest, error);
        throw error;
      }
    }

    const entry = this.nextEntry('structured');
    if (entry.error) throw reviveError(entry.error);
    if (typeof entry.response === 'string') return parseStructuredOutput(entry.response, request.schema);
    const result = request.schema.safeParse(entry.response);
    if (!result.success) {
      throw new AIValidationError(formatZodIssues(result.error), {
        details: { issues: result.error.issues },
      });
    }
    return result.data;
  }

  async healthCheck(): Promise<boolean> {
    if (this.mode === 'replaying') return true;
    return this.requireDelegate().healthCheck();
  }

  private async invoke(
    method: 'complete' | 'chat',
    request: unknown,
    call: (delegate: LLMProvider) => Promise<LLMResponse>,
  ): Promise<LLMResponse> {
    if (this.mode === 'recording') {
      try {
        const response = await call(this.requireDelegate());
        this.recorded.push({ method, request, response: response.text });
        return response;
      } catch (error) {
        this.recordFailure(method, request, error);
        throw error;
      }
    }

    const entry = this.nextEntry(method);
    if (entry.error) throw reviveError(entry.error);
    return { text: typeof entry.response === 'string' ? entry.response : '' };
  }

  private recordFailure(method: MockMethod, request: unknown, error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.recorded.push({
      method,
      request,
      error: { name: normalized.name, message: normalized.message },
    });
  }

  private nextEntry(method: MockMethod): RecordingEntry {
    const entries = this.replay ?? [];
    const entry = entries[this.replayCursor];
    if (!entry) {
      throw new InternalError(`Recording has no entry for ${method} call #${this.replayCursor + 1}`);
    }
    this.replayCursor += 1;
    if (entry.method !== method) {
      throw new InternalError(
        `Recording method mismatch at entry #${this.replayCursor}: expected ${entry.method}, got ${method}`,
      );
    }
    return entry;
  }

  private requireDelegate(): LLMProvider {
    if (!this.delegate) throw new InternalError('RecordingLLMProvider has no delegate provider');
    return this.delegate;
  }
}

function reviveError(error: { name: string; message: string }): Error {
  if (error.name === 'AIValidationError') return new AIValidationError(error.message);
  if (error.name === 'AIProviderError') return new AIProviderError(error.message);
  return new InternalError(error.message);
}

/** Load a previously saved recording from disk. */
export async function loadRecording(path: string): Promise<LLMRecording> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as LLMRecording;
}
