import { AIProviderError, AIValidationError } from '@jobs-app/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { OllamaProvider } from './OllamaProvider.js';

interface Captured {
  url: string;
  body: Record<string, unknown>;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** fetch stub that records calls and serves queued responses. */
function stubFetch(responses: Response[]): { impl: typeof fetch; calls: Captured[] } {
  const calls: Captured[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
    });
    const response = responses.shift();
    if (!response) throw new Error('stub fetch exhausted');
    return response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const provider = (impl: typeof fetch, timeoutMs = 1000) =>
  new OllamaProvider({ baseUrl: 'http://ollama.test', model: 'test-model', timeoutMs, fetchImpl: impl });

describe('OllamaProvider', () => {
  it('maps a complete request and returns text + usage', async () => {
    const { impl, calls } = stubFetch([
      jsonResponse({ response: 'hello world', model: 'test-model', prompt_eval_count: 3, eval_count: 2 }),
    ]);
    const result = await provider(impl).complete({
      prompt: 'hi',
      system: 'be terse',
      temperature: 0.2,
      maxTokens: 50,
    });

    expect(result.text).toBe('hello world');
    expect(result.usage).toEqual({ promptTokens: 3, completionTokens: 2, totalTokens: 5 });
    expect(calls[0]?.url).toBe('http://ollama.test/api/generate');
    expect(calls[0]?.body).toMatchObject({
      model: 'test-model',
      prompt: 'hi',
      system: 'be terse',
      stream: false,
      options: { temperature: 0.2, num_predict: 50 },
    });
  });

  it('maps chat messages, prepends the system message and honours the model override', async () => {
    const { impl, calls } = stubFetch([jsonResponse({ message: { content: 'ok' } })]);
    const result = await provider(impl).chat([{ role: 'user', content: 'hello' }], {
      model: 'other-model',
      system: 'system prompt',
    });

    expect(result.text).toBe('ok');
    expect(calls[0]?.url).toBe('http://ollama.test/api/chat');
    expect(calls[0]?.body).toMatchObject({ model: 'other-model', stream: false });
    expect(calls[0]?.body['messages']).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'hello' },
    ]);
  });

  it('parses structured output from JSON-mode chat', async () => {
    const { impl, calls } = stubFetch([jsonResponse({ message: { content: '{"ok":true}' } })]);
    const schema = z.object({ ok: z.boolean() });
    await expect(provider(impl).structured({ prompt: 'p', schema })).resolves.toEqual({ ok: true });
    expect(calls[0]?.body['format']).toBe('json');
  });

  it('retries once with a corrective prompt after malformed JSON', async () => {
    const { impl, calls } = stubFetch([
      jsonResponse({ message: { content: 'not json' } }),
      jsonResponse({ message: { content: '{"ok":true}' } }),
    ]);
    const schema = z.object({ ok: z.boolean() });
    await expect(provider(impl).structured({ prompt: 'p', schema })).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(2);

    const retryMessages = calls[1]?.body['messages'] as Array<{ role: string; content: string }>;
    expect(retryMessages[1]).toMatchObject({ role: 'assistant', content: 'not json' });
    expect(retryMessages[2]?.content).toContain('not valid for the required JSON schema');
  });

  it('throws AIValidationError when the retry also fails', async () => {
    const { impl, calls } = stubFetch([
      jsonResponse({ message: { content: 'still not json' } }),
      jsonResponse({ message: { content: '{"ok":"nope"}' } }),
    ]);
    const schema = z.object({ ok: z.boolean() });
    await expect(provider(impl).structured({ prompt: 'p', schema })).rejects.toBeInstanceOf(
      AIValidationError,
    );
    expect(calls).toHaveLength(2);
  });

  it('maps an aborted request to a timeout AIProviderError', async () => {
    const impl = ((_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      })) as unknown as typeof fetch;

    await expect(provider(impl, 5).complete({ prompt: 'slow' })).rejects.toMatchObject({
      code: 'AI_PROVIDER_ERROR',
      message: expect.stringContaining('timed out'),
    });
  });

  it('maps transport failures to AIProviderError', async () => {
    const impl = (() => Promise.reject(new TypeError('connection refused'))) as unknown as typeof fetch;
    await expect(provider(impl).complete({ prompt: 'hi' })).rejects.toBeInstanceOf(AIProviderError);
  });

  it('maps a non-2xx response to AIProviderError with status details', async () => {
    const { impl } = stubFetch([jsonResponse({ error: 'boom' }, 500)]);
    try {
      await provider(impl).complete({ prompt: 'hi' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderError);
      expect((error as AIProviderError).details?.['status']).toBe(500);
    }
  });

  it('maps an invalid JSON body to AIProviderError', async () => {
    const { impl } = stubFetch([new Response('not json', { status: 200 })]);
    await expect(provider(impl).complete({ prompt: 'hi' })).rejects.toBeInstanceOf(AIProviderError);
  });

  it('reports health from /api/version', async () => {
    const healthy = stubFetch([jsonResponse({ version: '1.0.0' })]);
    await expect(provider(healthy.impl).healthCheck()).resolves.toBe(true);
    expect(healthy.calls[0]?.url).toBe('http://ollama.test/api/version');

    const down = (() => Promise.reject(new TypeError('refused'))) as unknown as typeof fetch;
    await expect(provider(down).healthCheck()).resolves.toBe(false);
  });
});
