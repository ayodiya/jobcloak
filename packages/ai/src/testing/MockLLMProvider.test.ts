import { AIProviderError, AIValidationError } from '@jobs-app/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockLLMProvider } from './MockLLMProvider.js';

const schema = z.object({ ok: z.boolean() });

describe('MockLLMProvider', () => {
  it('returns configured complete text and records the call', async () => {
    const provider = new MockLLMProvider({ complete: 'hello' });
    await expect(provider.complete({ prompt: 'hi' })).resolves.toMatchObject({ text: 'hello' });
    expect(provider.calls).toEqual([{ method: 'complete', request: { prompt: 'hi' } }]);
  });

  it('returns configured chat text', async () => {
    const provider = new MockLLMProvider({ chat: 'reply' });
    await expect(provider.chat([{ role: 'user', content: 'hi' }])).resolves.toMatchObject({
      text: 'reply',
    });
  });

  it('resolves function responders with the recorded call', async () => {
    const provider = new MockLLMProvider({
      complete: (call) => `echo:${(call.request as { prompt: string }).prompt}`,
    });
    await expect(provider.complete({ prompt: 'ping' })).resolves.toMatchObject({ text: 'echo:ping' });
  });

  it('validates structured objects against the schema', async () => {
    await expect(
      new MockLLMProvider({ structured: { ok: true } }).structured({ prompt: 'p', schema }),
    ).resolves.toEqual({ ok: true });
  });

  it('parses string structured responders like a real provider', async () => {
    await expect(
      new MockLLMProvider({ structured: '```json\n{"ok":true}\n```' }).structured({ prompt: 'p', schema }),
    ).resolves.toEqual({ ok: true });
  });

  it('throws AIValidationError when a structured responder violates the schema', async () => {
    await expect(
      new MockLLMProvider({ structured: { ok: 'nope' } }).structured({ prompt: 'p', schema }),
    ).rejects.toBeInstanceOf(AIValidationError);
  });

  it('consumes queued responders in order (malformed then valid)', async () => {
    const provider = new MockLLMProvider({ structured: ['not json', '{"ok":true}'] });
    await expect(provider.structured({ prompt: 'p', schema })).rejects.toBeInstanceOf(AIValidationError);
    await expect(provider.structured({ prompt: 'p', schema })).resolves.toEqual({ ok: true });
  });

  it('rethrows configured provider errors', async () => {
    const provider = new MockLLMProvider({ complete: new AIProviderError('down') });
    await expect(provider.complete({ prompt: 'p' })).rejects.toBeInstanceOf(AIProviderError);
  });

  it('throws when no responder is configured', async () => {
    await expect(new MockLLMProvider().complete({ prompt: 'p' })).rejects.toBeInstanceOf(
      AIValidationError,
    );
  });

  it('reports configurable health', async () => {
    await expect(new MockLLMProvider({ health: true }).healthCheck()).resolves.toBe(true);
    await expect(new MockLLMProvider({ health: false }).healthCheck()).resolves.toBe(false);
    await expect(new MockLLMProvider({ health: () => false }).healthCheck()).resolves.toBe(false);
  });
});
