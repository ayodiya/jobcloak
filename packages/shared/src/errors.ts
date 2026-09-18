/**
 * Structured, semantic error types.
 *
 * Rules:
 * - Never `throw new Error('x failed')` where a semantic error type covers the case.
 * - Never swallow errors — re-throw as the appropriate semantic type.
 * - `AppError` carries a stable machine-readable `code` plus optional details.
 */

export type AppErrorCode =
  | 'CONFIG_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'NETWORK_ERROR'
  | 'AI_PROVIDER_ERROR'
  | 'AI_VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'BROWSER_ERROR'
  | 'AUTH_ERROR'
  | 'SOURCE_ERROR'
  | 'AUTOMATION_LIMIT'
  | 'INPUT_ERROR'
  | 'UNSUPPORTED'
  | 'INTERNAL';

export interface AppErrorOptions {
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, opts: AppErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = opts.details;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, code: this.code, message: this.message, details: this.details };
  }
}

export class ConfigError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('CONFIG_ERROR', message, opts);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('VALIDATION_ERROR', message, opts);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('NOT_FOUND', message, opts);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('CONFLICT', message, opts);
  }
}

export class NetworkError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('NETWORK_ERROR', message, opts);
  }
}

/** Error when calling an LLM provider (unreachable, timeout, HTTP failure). */
export class AIProviderError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('AI_PROVIDER_ERROR', message, opts);
  }
}

/** Error when model output fails structured validation. */
export class AIValidationError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('AI_VALIDATION_ERROR', message, opts);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('DATABASE_ERROR', message, opts);
  }
}

export class BrowserError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('BROWSER_ERROR', message, opts);
  }
}

export class AuthError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('AUTH_ERROR', message, opts);
  }
}

export class SourceError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('SOURCE_ERROR', message, opts);
  }
}

export class AutomationLimitError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('AUTOMATION_LIMIT', message, opts);
  }
}

export class InputError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('INPUT_ERROR', message, opts);
  }
}

export class UnsupportedError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('UNSUPPORTED', message, opts);
  }
}

export class InternalError extends AppError {
  constructor(message: string, opts: AppErrorOptions = {}) {
    super('INTERNAL', message, opts);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Marshal an unknown thrown value to an AppError, preserving known details. */
export function toAppError(error: unknown, fallback: string = 'Unexpected error'): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    return new InternalError(error.message, { cause: error });
  }
  return new InternalError(fallback, { cause: error });
}

/** Map an AppError to an HTTP status code for API serialization. */
export function appErrorToHttpStatus(error: AppError): number {
  switch (error.code) {
    case 'VALIDATION_ERROR':
    case 'INPUT_ERROR':
    case 'CONFIG_ERROR':
      return 400;
    case 'AUTH_ERROR':
      return 401;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
    case 'AUTOMATION_LIMIT':
      return 409;
    case 'UNSUPPORTED':
      return 422;
    default:
      return 500;
  }
}