import { type DestinationStream, type LevelWithSilent, type Logger } from 'pino';
export declare const SENSITIVE_KEYS: string[];
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
export declare function createLogger(opts: CreateLoggerOptions): Logger;
export type { Logger };
