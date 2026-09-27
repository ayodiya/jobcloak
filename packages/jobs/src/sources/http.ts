import { ValidationError } from '@jobs-app/shared';

/**
 * Identity used for all low-volume listing fetches. Sources only ever request
 * public listing pages/APIs at a modest rate and follow each site's robots.txt
 * and terms of service.
 */
export const HTTP_USER_AGENT = 'jobcloak-discovery/0.1 (+https://github.com/ayodiya/jobcloak)';

export interface FetchOptions {
  headers?: Record<string, string>;
  userAgent?: string;
  timeoutMs?: number;
}

export class HttpStatusError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string) {
    super(`Request to ${url} failed with HTTP status ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.url = url;
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;

/** GET a URL and return its raw text, hard-failing on non-2xx responses. */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': HTTP_USER_AGENT,
        accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        ...headers,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) throw new HttpStatusError(response.status, url);
    return await response.text();
  } catch (error) {
    if (error instanceof HttpStatusError) throw error;
    throw new ValidationError(`Failed to fetch ${url}: ${errorMessage(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

/** GET a URL and parse the body as JSON. */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ValidationError(`Invalid JSON from ${url}`);
  }
}

/** Coerce unknown job-source factory options into a plain options object. */
export function parseSourceOptions(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('Job source options must be an object');
  }
  return { ...(raw as Record<string, unknown>) };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
