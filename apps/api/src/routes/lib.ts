/**
 * Query-parameter parsing helpers for list endpoints. Fastify gives us
 * `Record<string, string | string[] | undefined>`; these helpers normalize a
 * small, deliberate subset we actually use (search, csv status, pagination,
 * sort) so every endpoint shares one convention.
 */

export interface ListQuery {
  search?: string;
  limit: number;
  offset: number;
  /** `field` or `-field` (descending). */
  sort?: string;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function parseListQuery(query: Record<string, string | string[] | undefined>): ListQuery {
  const requestedLimit = firstString(query.limit);
  const parsedLimit = requestedLimit ? Number.parseInt(requestedLimit, 10) : Number.NaN;
  const limit = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit)) : DEFAULT_LIMIT;
  const page = clampInt(firstString(query.page), 1, 1, Number.MAX_SAFE_INTEGER);
  const search = firstString(query.search)?.trim();
  return {
    search: search ? search : undefined,
    limit,
    offset: (page - 1) * limit,
    sort: firstString(query.sort),
  };
}

export function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Comma-separated value list, trimmed and de-duplicated preserving order. */
export function csv(value: string | string[] | undefined): string[] {
  const items = (firstString(value) ?? '').split(',').map((item) => item.trim());
  return Array.from(new Set(items.filter(Boolean)));
}

export function toBoolean(value: string | string[] | undefined, fallback = false): boolean {
  const raw = firstString(value);
  if (raw === undefined) return fallback;
  if (['true', '1', 'yes', 'on'].includes(raw.toLowerCase())) return true;
  if (['false', '0', 'no', 'off'].includes(raw.toLowerCase())) return false;
  return fallback;
}

export function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export type SortDirection = 'asc' | 'desc';

export function parseSort(value: string | undefined, fallback: string): { field: string; dir: SortDirection } {
  const raw = value?.trim() || fallback;
  const descending = raw.startsWith('-');
  return { field: descending ? raw.slice(1) : raw, dir: descending ? 'desc' : 'asc' };
}

export function paginate<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, hasMore: page * limit < total };
}