import { AIProviderError, NotFoundError, ValidationError } from '@jobs-app/shared';
import type { z } from 'zod';
import { OllamaProvider } from './providers/OllamaProvider.js';
import type { LLMProvider } from './providers/LLMProvider.js';
import type {
  ChatMessage,
  ChatOptions,
  LLMRequest,
  LLMResponse,
  StructuredLLMRequest,
} from './types.js';

export interface ModelTarget {
  provider: string;
  model?: string;
}

export interface ModelRouterOptions {
  defaultTarget: ModelTarget;
  /** Optional per-task overrides, e.g. a larger model for generation. */
  taskTargets?: Record<string, ModelTarget>;
  /** Targets tried in order when a provider is unhealthy or unreachable. */
  fallbackTargets?: ModelTarget[];
  /** How long a health result is trusted, in milliseconds. */
  healthCacheTtlMs?: number;
  /** Set false to skip health gating (e.g. single deterministic provider). */
  healthGating?: boolean;
  now?: () => number;
}

interface HealthState {
  ok: boolean;
  at: number;
}

const DEFAULT_HEALTH_TTL_MS = 30_000;

/**
 * Chooses a provider/model for a task and applies fallback + health gating.
 *
 * Fallback rules:
 * - Transport/unavailability failures (`AIProviderError`) move to the next
 *   candidate target.
 * - Validation failures (`AIValidationError`) do not: a different provider is
 *   not expected to fix a schema-violating response, and silent provider
 *   hopping would make output provenance unpredictable.
 */
export class ModelRouter {
  private readonly providers = new Map<string, LLMProvider>();
  private readonly defaultTarget: ModelTarget;
  private readonly taskTargets: Record<string, ModelTarget>;
  private readonly fallbackTargets: ModelTarget[];
  private readonly healthCacheTtlMs: number;
  private readonly healthGating: boolean;
  private readonly now: () => number;
  private readonly healthCache = new Map<string, HealthState>();

  constructor(providers: LLMProvider[], options: ModelRouterOptions) {
    if (providers.length === 0) {
      throw new ValidationError('ModelRouter requires at least one provider');
    }
    for (const provider of providers) this.register(provider);

    this.defaultTarget = options.defaultTarget;
    this.taskTargets = options.taskTargets ?? {};
    this.fallbackTargets = options.fallbackTargets ?? [];
    this.healthCacheTtlMs = options.healthCacheTtlMs ?? DEFAULT_HEALTH_TTL_MS;
    this.healthGating = options.healthGating ?? true;
    this.now = options.now ?? (() => Date.now());
  }

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  providerNames(): string[] {
    return [...this.providers.keys()];
  }

  getProvider(name: string): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new NotFoundError(`Unknown LLM provider: ${name}`);
    return provider;
  }

  /** Target for a task, falling back to the default target. */
  resolve(task?: string): ModelTarget {
    if (task !== undefined) {
      const target = this.taskTargets[task];
      if (target) return target;
    }
    return this.defaultTarget;
  }

  async complete(task: string | undefined, request: LLMRequest): Promise<LLMResponse> {
    return this.run(task, (provider, target) =>
      provider.complete({ ...request, model: request.model ?? target.model }),
    );
  }

  async chat(
    task: string | undefined,
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<LLMResponse> {
    return this.run(task, (provider, target) =>
      provider.chat(messages, { ...opts, model: opts.model ?? target.model }),
    );
  }

  async structured<S extends z.ZodTypeAny>(
    task: string | undefined,
    request: StructuredLLMRequest<S>,
  ): Promise<z.output<S>> {
    return this.run(task, (provider, target) =>
      provider.structured({ ...request, model: request.model ?? target.model }),
    );
  }

  /** Probe every registered provider; also refreshes the health cache. */
  async healthCheck(): Promise<Record<string, boolean>> {
    const entries = await Promise.all(
      [...this.providers.values()].map(async (provider) => {
        const ok = await probe(provider);
        this.healthCache.set(provider.name, { ok, at: this.now() });
        return [provider.name, ok] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  private async run<T>(
    task: string | undefined,
    call: (provider: LLMProvider, target: ModelTarget) => Promise<T>,
  ): Promise<T> {
    const candidates = dedupeTargets([this.resolve(task), ...this.fallbackTargets]);
    let lastError: AIProviderError | undefined;

    for (const target of candidates) {
      const provider = this.getProvider(target.provider);
      if (!(await this.isHealthy(provider))) {
        lastError = new AIProviderError(`AI provider '${provider.name}' is unavailable`);
        continue;
      }
      try {
        return await call(provider, target);
      } catch (error) {
        if (error instanceof AIProviderError) {
          this.healthCache.set(provider.name, { ok: false, at: this.now() });
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    throw lastError ?? new AIProviderError('No AI provider available');
  }

  private async isHealthy(provider: LLMProvider): Promise<boolean> {
    if (!this.healthGating) return true;
    const cached = this.healthCache.get(provider.name);
    const now = this.now();
    if (cached && now - cached.at < this.healthCacheTtlMs) return cached.ok;
    const ok = await probe(provider);
    this.healthCache.set(provider.name, { ok, at: now });
    return ok;
  }
}

function dedupeTargets(targets: ModelTarget[]): ModelTarget[] {
  const seen = new Set<string>();
  const result: ModelTarget[] = [];
  for (const target of targets) {
    const key = `${target.provider}:${target.model ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(target);
  }
  return result;
}

async function probe(provider: LLMProvider): Promise<boolean> {
  try {
    return await provider.healthCheck();
  } catch {
    return false;
  }
}

export interface CreateDefaultModelRouterOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  providers?: LLMProvider[];
  taskTargets?: Record<string, ModelTarget>;
  fallbackTargets?: ModelTarget[];
  healthGating?: boolean;
}

/**
 * Build a router with Ollama as the default provider (ADR-0002). Injecting
 * `providers` replaces the Ollama default entirely, which tests use.
 */
export function createDefaultModelRouter(
  options: CreateDefaultModelRouterOptions = {},
): ModelRouter {
  const model = options.model ?? 'qwen2.5-coder:3b';
  const providers =
    options.providers ??
    [new OllamaProvider({ baseUrl: options.baseUrl, model, timeoutMs: options.timeoutMs })];

  return new ModelRouter(providers, {
    defaultTarget: { provider: providers[0]?.name ?? 'ollama', model },
    ...(options.taskTargets ? { taskTargets: options.taskTargets } : {}),
    ...(options.fallbackTargets ? { fallbackTargets: options.fallbackTargets } : {}),
    ...(options.healthGating !== undefined ? { healthGating: options.healthGating } : {}),
  });
}
