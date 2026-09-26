import { z } from 'zod';

export const AutomationModeSchema = z.enum(['safe', 'review', 'auto_apply']);
export type AutomationMode = z.infer<typeof AutomationModeSchema>;

export const LogLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const IntPositive = z.coerce.number().int().min(0);

/**
 * Source of truth for the application configuration.
 *
 * Every variable used by the system is declared here with validation and safe
 * development defaults. Unknown or invalid values fail fast at boot.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: LogLevelSchema.default('info'),

  DATABASE_URL: z.string().url().default('postgresql://app:app@localhost:15432/jobs_applications?schema=public'),
  REDIS_URL: z.string().url().default('redis://localhost:6380'),

  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().min(1).default('qwen2.5-coder:3b'),
  OLLAMA_TIMEOUT_MS: IntPositive.default(120_000),

  AUTOMATION_MODE: AutomationModeSchema.default('review'),
  JOB_MATCH_THRESHOLD: z.coerce.number().min(0).max(100).default(70),
  AUTO_APPLY_THRESHOLD: z.coerce.number().min(0).max(100).default(85),
  APPLICATION_DAILY_LIMIT: IntPositive.default(10),
  JOB_DISCOVERY_DAILY_LIMIT: IntPositive.default(50),
  APPLICATION_PREPARATION_DAILY_LIMIT: IntPositive.default(20),

  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: IntPositive.default(3100),
  WEB_PORT: IntPositive.default(3000),
  WEB_ORIGIN: z.string().default('http://127.0.0.1:3000'),

  BROWSER_DATA_DIR: z.string().default('./data/browser-profiles'),
  BROWSER_HEADLESS: z
    .string()
    .transform((v) => ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()))
    .default('false'),
});

export type Env = z.infer<typeof envSchema>;

const parsedCache = new Map<string, Env>();
const CACHE_LIMIT = 64;

/** Parse and validate a raw environment object. Throws ConfigError on failure. */
export function parseEnv(raw: Record<string, string | undefined> = process.env): Env {
  // Cache by content snapshot, not object identity: callers (and tests) mutate
  // the raw object between parses and expect re-validation.
  const key = JSON.stringify(raw);
  const cached = parsedCache.get(key);
  if (cached) return cached;
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    const error = new Error(`Invalid configuration: ${issues}`) as Error & { code?: string };
    error.code = 'CONFIG_ERROR';
    throw error;
  }
  if (parsedCache.size >= CACHE_LIMIT) parsedCache.clear();
  parsedCache.set(key, result.data);
  return result.data;
}

/**
 * Load the resolved application configuration from the current process environment.
 * Cached per content snapshot; call `resetConfig` in tests between cases.
 */
export function loadConfig(raw: Record<string, string | undefined> = process.env): Env {
  return parseEnv(raw);
}

export function resetConfig(raw: Record<string, string | undefined> = process.env): void {
  parsedCache.delete(JSON.stringify(raw));
}

/**
 * Ordered `.env` file candidates to attempt, closest first. Used because npm
 * workspace scripts run with the workspace (e.g. `apps/api`) as their cwd while
 * the monorepo `.env` lives at the repo root.
 *
 * - `given === '.env'` (or a bare filename) is resolved against `cwd` and every
 *   ancestor directory.
 * - A path containing a directory is resolved against `cwd` only.
 * - An absolute `given` is used as-is.
 */
export function envFileCandidates(cwd: string, given: string): string[] {
  const candidates: string[] = [given];
  if (!given.startsWith('/')) {
    if (!given.includes('/')) {
      const parts = cwd.split('/').filter(Boolean);
      for (let i = parts.length; i > 0; i -= 1) {
        candidates.push(`/${parts.slice(0, i).join('/')}/${given}`);
      }
    } else {
      candidates.push(`${cwd.replace(/\/+$/, '')}/${given}`);
    }
  }
  return Array.from(new Set(candidates));
}

/**
 * Load a `.env` file into process.env using Node's native loader. No-op when
 * no candidate file is present (callers that already have env set — e.g. CI —
 * are fine).
 */
export function loadEnvFileIfExists(path: string = '.env'): void {
  for (const candidate of envFileCandidates(process.cwd(), path)) {
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // candidate not present; try the next
    }
  }
}

export const AUTOMATION_MODES: AutomationMode[] = ['safe', 'review', 'auto_apply'];