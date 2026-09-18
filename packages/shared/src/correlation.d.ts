/** Start a request/operation scope, returning the new correlation id. */
export declare function withCorrelation<T>(fn: () => T, correlationId?: string): T;
/** The active correlation id for the current async scope, if any. */
export declare function currentCorrelationId(): string | undefined;
/** Generate a fresh UUID v4. */
export declare function newId(): string;
