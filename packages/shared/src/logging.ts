import { pino, type DestinationStream, type LevelWithSilent, type Logger, type LoggerOptions } from 'pino';
import { currentCorrelationId } from './correlation.js';

export const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'cookies',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'session',
  'privatekey',
  'private_key',
  'phonenumber',
  'ssn',
];

export interface CreateLoggerOptions {
  service: string;
  level?: LevelWithSilent;
  /** Namespaced subset of SENSITIVE_KEYS to redact (defaults to all). */
  redactKeys?: string[];
  baseOverrides?: Record<string, unknown>;
  pretty?: boolean;
  /** Optional sink. Defaults to stdout; tests inject an in-memory sink. */
  destination?: DestinationStream;
}

/**
 * Build a pino logger:
 * - structured JSON output (pretty-piped only when explicitly enabled)
 * - redaction of credential-shaped keys at the serializer level
 * - a `cid` field automatically bound from the current correlation scope
 */
export function createLogger(opts: CreateLoggerOptions): Logger {
  const redactKeys = opts.redactKeys ?? SENSITIVE_KEYS;
  const redactPatterns = redactKeys.flatMap((key) => {
    // Match the key at the root and a couple of nesting levels, including its
    // camelCase and PascalCase spellings ('apiKey', 'ApiKey', 'API_KEY'...).
    const camel = key
      .toLowerCase()
      .replace(/(^|_)(\w)/g, (_, __, c: string) => c.toUpperCase())
      .replace(/_/g, '');
    const camelLower = camel.charAt(0).toLowerCase() + camel.slice(1);
    const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
    const spellings = new Set([key.toLowerCase(), camelLower, pascal]);
    const placements = ['', '*', '*.*', '*.*.*'];
    return Array.from(spellings).flatMap((spelling) =>
      placements.map((prefix) => (prefix ? `${prefix}.${spelling}` : spelling)),
    );
  });

  const loggerOptions: LoggerOptions = {
    name: opts.service,
    level: opts.level ?? 'info',
    redact: {
      paths: redactPatterns,
      censor: '[REDACTED]',
    },
    base: {
      service: opts.service,
      ...opts.baseOverrides,
    },
    formatters: {
      log(obj) {
        const cid = currentCorrelationId();
        if (cid) {
          return { ...obj, cid };
        }
        return obj;
      },
    },
    ...(opts.pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
          },
        }
      : {}),
  };

  return opts.pretty ? pino(loggerOptions) : pino(loggerOptions, opts.destination);
}

export type { Logger };