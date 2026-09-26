import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APPLICATION_MODES,
  APPLICATION_STATUSES,
  ApiError,
  JOB_STATUSES,
  apiFetch,
  listParams,
} from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listParams', () => {
it('includes defined scalar values in insertion order', () => {
    expect(listParams({ page: 2, limit: 20, status: 'Active', remote: true })).toBe(
      '?page=2&limit=20&status=Active&remote=true',
    );
  });

  it('skips null, undefined, and empty strings', () => {
    expect(listParams({ page: 1, status: '', city: null, note: undefined })).toBe('?page=1');
  });

  it('returns an empty string when nothing is provided', () => {
    expect(listParams({})).toBe('');
    expect(listParams({ a: undefined, b: null, c: '' })).toBe('');
  });
});

describe('apiFetch', () => {
  it('returns the parsed JSON body on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/jobs?limit=1')).resolves.toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/jobs?limit=1');
  });

  it('propagates JSON content-type by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/jobs');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('throws an ApiError with the response text on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })),
    );

    const error = await apiFetch('/jobs/1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'Not Found' });
  });

  it('falls back to a generic message when the failure body is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    const error = await apiFetch('/jobs').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, message: 'Request failed (500)' });
  });
});

describe('enums mirror the public API', () => {
  it('declares the job statuses', () => {
    expect(JOB_STATUSES).toEqual(['Active', 'Closed', 'Unknown']);
  });

  it('declares the application statuses', () => {
    expect(APPLICATION_STATUSES).toEqual([
      'Prepared',
      'InProgress',
      'Submitted',
      'Verified',
      'Failed',
      'Cancelled',
      'Rejected',
    ]);
  });

  it('declares the automation modes', () => {
    expect(APPLICATION_MODES).toEqual(['safe', 'review', 'auto_apply']);
  });
});