import { AIProviderError, AIValidationError, NotFoundError, ValidationError } from '@jobs-app/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ModelRouter, createDefaultModelRouter } from './ModelRouter.js';
import { MockLLMProvider } from './testing/MockLLMProvider.js';

const ResultSchema = z.object({ ok: z.boolean() });

function primary(options: ConstructorParameters<typeof MockLLMProvider>[0] = {}): MockLLMProvider {
  return new MockLLMProvider({ name: 'primary', ...options });
}

function backup(options: ConstructorParameters<typeof MockLLMProvider>[0] = {}): MockLLMProvider {
  return new MockLLMProvider({ name: 'backup', ...options });
}

describe('ModelRouter', () => {
  it('requires at least one provider', () => {
    expect(() => new ModelRouter([], { defaultTarget: { provider: 'x' } })).toThrow(ValidationError);
  });

  it('resolves the default target and per-task overrides', () => {
    const router = new ModelRouter([primary()], {
      defaultTarget: { provider: 'primary', model: 'small' },
      taskTargets: { generate: { provider: 'primary', model: 'big' } },
    });
    expect(router.resolve()).toEqual({ provider: 'primary', model: 'small' });
    expect(router.resolve('generate')).toEqual({ provider: 'primary', model: 'big' });
    expect(router.resolve('unknown')).toEqual({ provider: 'primary', model: 'small' });
  });

  it('throws for an unknown provider', () => {
    const router = new ModelRouter([primary()], { defaultTarget: { provider: 'primary' } });
    expect(() => router.getProvider('nope')).toThrow(NotFoundError);
  });

  it('injects the target model into complete calls', async () => {
    const provider = primary({ complete: 'hello' });
    const router = new ModelRouter([provider], {
      defaultTarget: { provider: 'primary', model: 'small' },
    });
    const response = await router.complete(undefined, { prompt: 'hi' });
    expect(response.text).toBe('hello');
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.request).toMatchObject({ prompt: 'hi', model: 'small' });
  });

  it('routes structured calls and returns validated output', async () => {
    const router = new ModelRouter([primary({ structured: { ok: true } })], {
      defaultTarget: { provider: 'primary' },
    });
    await expect(router.structured(undefined, { prompt: 'p', schema: ResultSchema })).resolves.toEqual({
      ok: true,
    });
  });

  it('falls back to the next target when a provider is unreachable', async () => {
    const first = primary({ complete: new AIProviderError('down') });
    const second = backup({ complete: 'recovered' });
    const router = new ModelRouter([first, second], {
      defaultTarget: { provider: 'primary' },
      fallbackTargets: [{ provider: 'backup' }],
    });

    await expect(router.complete(undefined, { prompt: 'hi' })).resolves.toMatchObject({
      text: 'recovered',
    });
    expect(second.calls).toHaveLength(1);
  });

  it('does not fall back on a validation failure', async () => {
    const first = primary({ structured: new AIValidationError('bad shape') });
    const second = backup({ structured: { ok: true } });
    const router = new ModelRouter([first, second], {
      defaultTarget: { provider: 'primary' },
      fallbackTargets: [{ provider: 'backup' }],
    });

    await expect(
      router.structured(undefined, { prompt: 'p', schema: ResultSchema }),
    ).rejects.toBeInstanceOf(AIValidationError);
    expect(second.calls).toHaveLength(0);
  });

  it('skips a provider reported unhealthy', async () => {
    const first = primary({ health: false, complete: 'should not run' });
    const second = backup({ health: true, complete: 'from backup' });
    const router = new ModelRouter([first, second], {
      defaultTarget: { provider: 'primary' },
      fallbackTargets: [{ provider: 'backup' }],
    });

    await expect(router.complete(undefined, { prompt: 'hi' })).resolves.toMatchObject({
      text: 'from backup',
    });
    expect(first.calls).toHaveLength(0);
  });

  it('reports health for every provider', async () => {
    const router = new ModelRouter([primary({ health: true }), backup({ health: false })], {
      defaultTarget: { provider: 'primary' },
    });
    await expect(router.healthCheck()).resolves.toEqual({ primary: true, backup: false });
  });

  it('builds an Ollama router by default', () => {
    const router = createDefaultModelRouter();
    expect(router.providerNames()).toEqual(['ollama']);
    expect(router.resolve()).toEqual({ provider: 'ollama', model: 'qwen2.5-coder:3b' });
  });
});
