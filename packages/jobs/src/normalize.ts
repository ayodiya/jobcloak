import { ValidationError } from '@jobs-app/shared';
import { z } from 'zod';
import { computeFingerprint, normalizeUrl } from './fingerprint.js';
import type { Job, NormalizedJob } from './types.js';

const REMOTE_PATTERN =
  /(^|[^a-z])(remote|fully remote|work from home|wfh|anywhere|distributed team)([^a-z]|$)/i;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Collapse whitespace to single spaces and trim. */
export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Convert listing HTML into readable plain text without external deps. */
export function toPlainText(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** True when location/description indicate a remote role. */
export function detectRemote(location?: string, description?: string): boolean {
  return REMOTE_PATTERN.test(`${location ?? ''} ${description ?? ''}`);
}

export interface ParsedSalary {
  min?: number;
  max?: number;
  currency?: string;
}

const CURRENCY_BY_SYMBOL: Record<string, string> = { $: 'USD', '£': 'GBP', '€': 'EUR' };

/** Best-effort salary extraction, e.g. "$120,000 - $150,000", "£80k–£95k". */
export function parseSalary(text: string): ParsedSalary | undefined {
  const match = text.match(
    /([$£€])\s?(\d[\d,.]*)\s?(k)?\s*(?:-|–|—|to)\s*(?:[$£€]\s?)?(\d[\d,.]*)\s?(k)?/i,
  );
  if (!match) return undefined;

  const [, symbol = '$', rawMin = '', minK, rawMax = '', maxK] = match;
  const toNumber = (raw: string, thousands?: string): number | undefined => {
    const value = Number.parseFloat(raw.replace(/,/g, ''));
    if (Number.isNaN(value)) return undefined;
    return thousands ? Math.round(value * 1000) : value;
  };

  const min = toNumber(rawMin, minK);
  const max = toNumber(rawMax, maxK);
  if (min === undefined && max === undefined) return undefined;
  return { min, max, currency: CURRENCY_BY_SYMBOL[symbol] ?? undefined };
}

/** Zod boundary for source output; fails fast on missing required fields. */
export const JobInputSchema = z.object({
  sourceName: z.string().min(1),
  url: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  description: z.string().default(''),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  employmentType: z.string().optional(),
  seniority: z.string().optional(),
  salaryMin: z.number().int().nonnegative().optional(),
  salaryMax: z.number().int().nonnegative().optional(),
  salaryCurrency: z.string().min(1).optional(),
  postedAt: z.coerce.date().optional(),
  externalId: z.string().optional(),
  raw: z.unknown().optional(),
});

export type JobInput = z.input<typeof JobInputSchema>;

/** Validate a source's raw job payload into the canonical `Job` shape. */
export function parseJob(input: unknown): Job {
  const result = JobInputSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new ValidationError(`Invalid job payload: ${issues}`, {
      details: { issues: result.error.issues },
    });
  }
  return result.data as Job;
}

/**
 * Produce the canonical, deduplicated form of a job: trimmed text fields,
 * plain-text description, canonical URL, fingerprint and derived remote flag.
 */
export function normalizeJob(job: Job): NormalizedJob {
  const description = toPlainText(job.description);
  const remote = job.remote ?? detectRemote(job.location, description);
  const salary = parseSalary(description);

  return {
    ...job,
    title: normalizeText(job.title),
    company: normalizeText(job.company),
    location: job.location ? normalizeText(job.location) : undefined,
    description,
    remote,
    salaryMin: job.salaryMin ?? salary?.min,
    salaryMax: job.salaryMax ?? salary?.max,
    salaryCurrency: job.salaryCurrency ?? salary?.currency,
    normalizedUrl: normalizeUrl(job.url),
    fingerprint: computeFingerprint(job.url),
  };
}
