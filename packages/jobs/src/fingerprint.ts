import { createHash } from 'node:crypto';
import { ValidationError } from '@jobs-app/shared';

/** Query parameters removed during normalization (analytics/tracking noise). */
const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'yclid',
  'si',
  '_hsenc',
  '_hsmi',
  'vero_id',
  'oly_anon_id',
  'oly_enc_id',
]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

/**
 * Canonicalize a listing URL for deduplication:
 * - lowercase host, drop `www.` and default ports
 * - drop fragments and tracking/analytics query parameters
 * - sort remaining query parameters for a stable order
 * - collapse duplicate slashes and drop a trailing slash
 *
 * Throws `ValidationError` for unparseable URLs so callers fail fast.
 */
export function normalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ValidationError(`Invalid job URL: ${input}`, { details: { url: input } });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError(`Unsupported job URL protocol: ${url.protocol}`, {
      details: { url: input },
    });
  }

  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !isTrackingParam(key))
    .sort(([aKey, aVal], [bKey, bVal]) => aKey.localeCompare(bKey) || aVal.localeCompare(bVal));

  url.search = '';
  for (const [key, value] of params) url.searchParams.append(key, value);

  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';

  const port = url.port === '80' || url.port === '443' ? '' : url.port;
  const search = url.searchParams.toString();
  return `${url.protocol}//${url.hostname}${port ? `:${port}` : ''}${url.pathname}${
    search ? `?${search}` : ''
  }`;
}

/** sha1(host + normalizedUrl) — the deterministic dedupe fingerprint. */
export function computeFingerprint(url: string): string {
  const normalized = normalizeUrl(url);
  const { host } = new URL(normalized);
  return createHash('sha1').update(`${host}${normalized}`).digest('hex');
}
