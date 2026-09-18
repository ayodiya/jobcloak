import { describe, expect, it } from 'vitest';
import { createLogger, SENSITIVE_KEYS, type Logger } from './logging.js';

function captureLogger(service: string): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const logger = createLogger({
    service,
    level: 'trace',
    destination: { write: (msg: string) => lines.push(msg) },
  });
  return { logger, lines };
}

describe('createLogger', () => {
  it('redacts sensitive keys in log payloads', () => {
    const { logger, lines } = captureLogger('test');
    logger.info({ apiKey: 'super-secret-123', token: 't0ken', message: 'ok' });

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.service).toBe('test');
    expect(parsed.apiKey).toBe('[REDACTED]');
    expect(parsed.token).toBe('[REDACTED]');
    // 'message' is pino's reserved key and survives.
    expect(parsed.message).toBe('ok');
  });

  it('does not redact non-sensitive values', () => {
    const { logger, lines } = captureLogger('test');
    logger.info({ jobId: 'abc', correlation: 'xyz' });
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.jobId).toBe('abc');
  });

  it('emits structured JSON lines with service base field', () => {
    const { logger, lines } = captureLogger('api');
    logger.error('boom');
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.service).toBe('api');
    expect(parsed.level).toBe(50);
    expect(typeof parsed.time).toBe('number');
  });

  it('declares the sensitive key list', () => {
    expect(SENSITIVE_KEYS).toContain('token');
    expect(SENSITIVE_KEYS).toContain('authorization');
  });
});