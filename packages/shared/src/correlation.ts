import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const requestStorage = new AsyncLocalStorage<{ correlationId: string }>();

/** Start a request/operation scope, returning the new correlation id. */
export function withCorrelation<T>(fn: () => T, correlationId: string = newId()): T {
  return requestStorage.run({ correlationId }, fn);
}

/** The active correlation id for the current async scope, if any. */
export function currentCorrelationId(): string | undefined {
  return requestStorage.getStore()?.correlationId;
}

/** Generate a fresh UUID v4. */
export function newId(): string {
  return randomUUID();
}