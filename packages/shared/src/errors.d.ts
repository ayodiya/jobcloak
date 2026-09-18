/**
 * Structured, semantic error types.
 *
 * Rules:
 * - Never `throw new Error('x failed')` where a semantic error type covers the case.
 * - Never swallow errors — re-throw as the appropriate semantic type.
 * - `AppError` carries a stable machine-readable `code` plus optional details.
 */
export type AppErrorCode = 'CONFIG_ERROR' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'NETWORK_ERROR' | 'AI_PROVIDER_ERROR' | 'AI_VALIDATION_ERROR' | 'DATABASE_ERROR' | 'BROWSER_ERROR' | 'AUTH_ERROR' | 'SOURCE_ERROR' | 'AUTOMATION_LIMIT' | 'INPUT_ERROR' | 'UNSUPPORTED' | 'INTERNAL';
export interface AppErrorOptions {
    cause?: unknown;
    details?: Record<string, unknown>;
}
export declare class AppError extends Error {
    readonly code: AppErrorCode;
    readonly details?: Record<string, unknown>;
    readonly cause?: unknown;
    constructor(code: AppErrorCode, message: string, opts?: AppErrorOptions);
    toJSON(): Record<string, unknown>;
}
export declare class ConfigError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class ValidationError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class NotFoundError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class ConflictError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class NetworkError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
/** Error when calling an LLM provider (unreachable, timeout, HTTP failure). */
export declare class AIProviderError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
/** Error when model output fails structured validation. */
export declare class AIValidationError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class DatabaseError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class BrowserError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class AuthError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class SourceError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class AutomationLimitError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class InputError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class UnsupportedError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare class InternalError extends AppError {
    constructor(message: string, opts?: AppErrorOptions);
}
export declare function isAppError(error: unknown): error is AppError;
/** Marshal an unknown thrown value to an AppError, preserving known details. */
export declare function toAppError(error: unknown, fallback?: string): AppError;
/** Map an AppError to an HTTP status code for API serialization. */
export declare function appErrorToHttpStatus(error: AppError): number;
