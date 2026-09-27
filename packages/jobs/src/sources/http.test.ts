import { ValidationError } from '@jobs-app/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchText, HttpStatusError, parseSourceOptions } from './http.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: unknown, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(String(response), { status })),
  );
}

describe('fetchText', () => {
  it('returns the response body for 2xx responses', async () => {
    stubFetch('<h1>hello</h1>');
    await expect(fetchText('https://example.test/list')).resolves.toBe('<h1>hello</h1>');
  });

  it('throws HttpStatusError for non-2xx responses', async () => {
    stubFetch('oops', 503);
    const error = await fetchText('https://example.test/list').catch((e) => e);
    expect(error).toBeInstanceOf(HttpStatusError);
    expect(error.status).toBe(503);
    expect(error.url).toBe('https://example.test/list');
  });

  it('throws ValidationError when the network fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    await expect(fetchText('https://example.test/list')).rejects.toThrow(ValidationError);
  });
});

describe('fetchJson', () => {
  it('parses JSON bodies', async () => {
    stubFetch(JSON.stringify({ jobs: [1] }));
    await expect(fetchJson<{ jobs: number[] }>('https://example.test/api')).resolves.toEqual({
      jobs: [1],
    });
  });

  it('throws ValidationError on malformed JSON', async () => {
    stubFetch('not json');
    await expect(fetchJson('https://example.test/api')).rejects.toThrow(ValidationError);
  });
});

describe('parseSourceOptions', () => {
  it('returns an empty object for undefined/null options', () => {
    expect(parseSourceOptions(undefined)).toEqual({});
    expect(parseSourceOptions(null)).toEqual({});
  });

  it('rejects non-object options', () => {
    expect(() => parseSourceOptions('nope')).toThrow(ValidationError);
    expect(() => parseSourceOptions([1])).toThrow(ValidationError);
  });

  it('copies plain object options', () => {
    expect(parseSourceOptions({ sponsorshipOnly: true })).toEqual({ sponsorshipOnly: true });
  });
});
