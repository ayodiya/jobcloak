import { describe, expect, it } from 'vitest';
import { AutomationModeSchema, envSchema, loadConfig, parseEnv, resetConfig } from './env.js';

function minimalEnv(): Record<string, string | undefined> {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://app:app@localhost:15432/jobs_applications_test?schema=public',
    REDIS_URL: 'redis://localhost:6380',
    OLLAMA_BASE_URL: 'http://localhost:11434',
    OLLAMA_MODEL: 'qwen2.5-coder:3b',
    AUTOMATION_MODE: 'review',
  };
}

describe('parseEnv', () => {
  it('produces validated defaults for a partial environment', () => {
    const env = parseEnv({ NODE_ENV: 'test' });
    expect(env.AUTOMATION_MODE).toBe('review');
    expect(env.JOB_MATCH_THRESHOLD).toBe(70);
    expect(env.APPLICATION_DAILY_LIMIT).toBe(10);
    expect(env.OLLAMA_MODEL).toBe('qwen2.5-coder:3b');
    expect(env.API_HOST).toBe('127.0.0.1');
  });

  it('accepts a complete environment', () => {
    expect(() => parseEnv(minimalEnv())).not.toThrow();
  });

  it('rejects an invalid automation mode', () => {
    const env = minimalEnv();
    env.AUTOMATION_MODE = 'oops';
    expect(() => parseEnv(env)).toThrow(/Invalid configuration/);
  });

  it('rejects a negative daily limit', () => {
    const env = minimalEnv();
    env.APPLICATION_DAILY_LIMIT = '-3';
    expect(() => parseEnv(env)).toThrow(/Invalid configuration/);
  });

  it('rejects a non-url database url', () => {
    const env = minimalEnv();
    env.DATABASE_URL = 'not-a-url';
    expect(() => parseEnv(env)).toThrow(/Invalid configuration/);
  });

  it('clamps threshold to 0..100', () => {
    const env = minimalEnv();
    env.JOB_MATCH_THRESHOLD = '150';
    expect(() => parseEnv(env)).toThrow();
    env.JOB_MATCH_THRESHOLD = '101';
    expect(() => parseEnv(env)).toThrow();
  });

  it('parses boolean browser flags', () => {
    const env = minimalEnv();
    env.BROWSER_HEADLESS = 'true';
    expect(parseEnv(env).BROWSER_HEADLESS).toBe(true);
    env.BROWSER_HEADLESS = '0';
    expect(parseEnv(env).BROWSER_HEADLESS).toBe(false);
  });

  it('caches parse results per environment object and can be reset', () => {
    const raw = minimalEnv();
    const first = parseEnv(raw);
    expect(parseEnv(raw)).toBe(first);
    resetConfig(raw);
    expect(parseEnv(raw)).not.toBe(first);
  });

  it('loadConfig reads process env by default', () => {
    resetConfig();
    const cfg = loadConfig();
    expect(cfg.AUTOMATION_MODE).toBe('review');
  });
});

describe('AutomationModeSchema', () => {
  it('only accepts the three supported modes', () => {
    expect(AutomationModeSchema.parse('safe')).toBe('safe');
    expect(AutomationModeSchema.parse('review')).toBe('review');
    expect(AutomationModeSchema.parse('auto_apply')).toBe('auto_apply');
    expect(AutomationModeSchema.safeParse('nope').success).toBe(false);
  });
});

describe('envSchema shape', () => {
  it('declares all documented variables', () => {
    const shape = envSchema.shape;
    for (const key of [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'OLLAMA_BASE_URL',
      'OLLAMA_MODEL',
      'AUTOMATION_MODE',
      'JOB_MATCH_THRESHOLD',
      'AUTO_APPLY_THRESHOLD',
      'APPLICATION_DAILY_LIMIT',
      'JOB_DISCOVERY_DAILY_LIMIT',
      'APPLICATION_PREPARATION_DAILY_LIMIT',
      'API_HOST',
      'API_PORT',
      'WEB_PORT',
      'BROWSER_DATA_DIR',
      'BROWSER_HEADLESS',
      'LOG_LEVEL',
    ]) {
      expect((shape as unknown as Record<string, unknown>)[key], key).toBeDefined();
    }
  });
});