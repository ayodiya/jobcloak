/** Small deterministic text vocabulary for matching dimensions. */

export const SENIORITY_ORDER = ['junior', 'mid', 'senior', 'lead', 'staff', 'principal'] as const;
export type SeniorityLevel = (typeof SENIORITY_ORDER)[number];

const SENIORITY_MARKERS: Array<{ level: SeniorityLevel; pattern: RegExp }> = [
  { level: 'junior', pattern: /\b(junior|jr\.?|entry[- ]level|graduate)\b/i },
  { level: 'mid', pattern: /\bmid(?:dle)?[- ]level\b|\bintermediate\b/i },
  { level: 'senior', pattern: /\b(senior|sr\.?|snr)\b/i },
  { level: 'lead', pattern: /\b(lead|leadership)\b/i },
  { level: 'staff', pattern: /\bstaff\b/i },
  { level: 'principal', pattern: /\bprincipal\b/i },
];

export function inferSeniority(text: string): { level?: SeniorityLevel; found: SeniorityLevel[] } {
  const found: SeniorityLevel[] = [];
  for (const marker of SENIORITY_MARKERS) {
    if (marker.pattern.test(text)) found.push(marker.level);
  }
  const level = found.length === 0 ? undefined : SENIORITY_ORDER[Math.max(...found.map((l) => SENIORITY_ORDER.indexOf(l)))];
  return { level, found };
}

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'our',
  'your',
  'senior',
  'junior',
  'lead',
  'staff',
  'principal',
  'mid',
  'sr',
  'snr',
  'of',
  'in',
  'to',
  'at',
  'an',
  'a',
]);

/** Meaningful lowercase keyword tokens for role overlap scoring. */
export function roleKeywords(...texts: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const token of text.toLowerCase().split(/[^a-z0-9+#.]+/i)) {
      if (token.length < 2 || STOPWORDS.has(token)) continue;
      seen.add(token);
    }
  }
  return [...seen];
}

const DOMAINS: Array<{ name: string; aliases: string[] }> = [
  { name: 'fintech', aliases: ['fintech', 'fin-tech', 'payments', 'payment', 'banking', 'finance', 'ledger'] },
  { name: 'healthcare', aliases: ['healthcare', 'health-tech', 'healthtech', 'medtech', 'medical', 'clinical'] },
  { name: 'e-commerce', aliases: ['ecommerce', 'e-commerce', 'marketplace', 'retail'] },
  { name: 'saas/b2b', aliases: ['saas', 'b2b', 'software as a service', 'b2b saas'] },
  { name: 'security', aliases: ['security', 'cybersecurity', 'cyber security', 'infosec', 'iam'] },
  { name: 'data/ml', aliases: ['machine learning', 'data science', 'data platform', 'big data', 'analytics', 'ml'] },
  { name: 'platform/devops', aliases: ['devops', 'sre', 'platform engineering', 'observability'] },
  { name: 'blockchain', aliases: ['blockchain', 'web3', 'crypto'] },
];

export function detectDomains(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const domain of DOMAINS) {
    const matched = domain.aliases.some((alias) =>
      alias.includes(' ')
        ? lower.includes(alias)
        : new RegExp(`(^|[^a-z])${escape(alias)}([^a-z]|$)`, 'i').test(lower),
    );
    if (matched) found.push(domain.name);
  }
  return found;
}

/** Patterns indicating the employer demands existing work authorization. */
const AUTHORIZATION_MARKERS = [
  /\bauthorized to work\b/i,
  /\bwork authori[sz]ation\b/i,
  /\bmust be legally authorized\b/i,
  /\bno sponsorship\b/i,
  /\bcannot sponsor\b/i,
  /\bwithout (?:visa )?sponsorship\b/i,
];

export function requiresAuthorization(text: string): boolean {
  return AUTHORIZATION_MARKERS.some((marker) => marker.test(text));
}

/**
 * Candidate signals that sponsorship is not needed. Deliberately coarse and
 * conservative: the model prefers false negatives over incorrect positives
 * (unknown is treated as not-authorized by the scorer). Prefer structured
 * profile fields over free-text regex where available.
 */
const AUTHORIZED_SIGNALS = [
  /\bno sponsorship\b/i,
  /\bno visa\b/i,
  /\bauthorized\b/i,
  /\bpermanent resident\b/i,
  /\bcitizen\b/i,
  /\bblue card\b/i,
  /\bwork permit\b/i,
];

export interface AuthorizationStatus {
  /** True when the candidate evidences eligibility without employer sponsorship. */
  authorized: boolean;
  /** True when we simply cannot tell from the profile. */
  unknown: boolean;
}

export function candidateAuthorizationStatus(workAuthorization?: string, visaStatus?: string): AuthorizationStatus {
  const text = `${workAuthorization ?? ''} ${visaStatus ?? ''}`.trim();
  if (text.length === 0) return { authorized: false, unknown: true };
  return { authorized: AUTHORIZED_SIGNALS.some((signal) => signal.test(text)), unknown: false };
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalize and clamp a ratio to [0, 1]. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}