import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { currentCorrelationId, newId, withCorrelation } from './correlation.js';

describe('correlation scoping', () => {
  it('is undefined outside a scope', () => {
    expect(currentCorrelationId()).toBeUndefined();
  });

  it('exposes the correlation id inside an async scope', () => {
    const id = withCorrelation(() => currentCorrelationId());
    expect(id).toBeDefined();
  });

  it('propagates across async boundaries', async () => {
    const captured = await withCorrelation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return currentCorrelationId();
    });
    expect(captured).toBeDefined();
  });

  it('honors an explicit correlation id', () => {
    const expected = randomUUID();
    const got = withCorrelation(() => currentCorrelationId(), expected);
    expect(got).toBe(expected);
  });

  it('newId returns unique uuids', () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
  });
});