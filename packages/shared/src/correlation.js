import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
const requestStorage = new AsyncLocalStorage();
/** Start a request/operation scope, returning the new correlation id. */
export function withCorrelation(fn, correlationId = newId()) {
    return requestStorage.run({ correlationId }, fn);
}
/** The active correlation id for the current async scope, if any. */
export function currentCorrelationId() {
    return requestStorage.getStore()?.correlationId;
}
/** Generate a fresh UUID v4. */
export function newId() {
    return randomUUID();
}
//# sourceMappingURL=correlation.js.map