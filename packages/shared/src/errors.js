/**
 * Structured, semantic error types.
 *
 * Rules:
 * - Never `throw new Error('x failed')` where a semantic error type covers the case.
 * - Never swallow errors — re-throw as the appropriate semantic type.
 * - `AppError` carries a stable machine-readable `code` plus optional details.
 */
export class AppError extends Error {
    code;
    details;
    cause;
    constructor(code, message, opts = {}) {
        super(message);
        this.name = new.target.name;
        this.code = code;
        this.details = opts.details;
        if (opts.cause !== undefined)
            this.cause = opts.cause;
    }
    toJSON() {
        return { name: this.name, code: this.code, message: this.message, details: this.details };
    }
}
export class ConfigError extends AppError {
    constructor(message, opts = {}) {
        super('CONFIG_ERROR', message, opts);
    }
}
export class ValidationError extends AppError {
    constructor(message, opts = {}) {
        super('VALIDATION_ERROR', message, opts);
    }
}
export class NotFoundError extends AppError {
    constructor(message, opts = {}) {
        super('NOT_FOUND', message, opts);
    }
}
export class ConflictError extends AppError {
    constructor(message, opts = {}) {
        super('CONFLICT', message, opts);
    }
}
export class NetworkError extends AppError {
    constructor(message, opts = {}) {
        super('NETWORK_ERROR', message, opts);
    }
}
/** Error when calling an LLM provider (unreachable, timeout, HTTP failure). */
export class AIProviderError extends AppError {
    constructor(message, opts = {}) {
        super('AI_PROVIDER_ERROR', message, opts);
    }
}
/** Error when model output fails structured validation. */
export class AIValidationError extends AppError {
    constructor(message, opts = {}) {
        super('AI_VALIDATION_ERROR', message, opts);
    }
}
export class DatabaseError extends AppError {
    constructor(message, opts = {}) {
        super('DATABASE_ERROR', message, opts);
    }
}
export class BrowserError extends AppError {
    constructor(message, opts = {}) {
        super('BROWSER_ERROR', message, opts);
    }
}
export class AuthError extends AppError {
    constructor(message, opts = {}) {
        super('AUTH_ERROR', message, opts);
    }
}
export class SourceError extends AppError {
    constructor(message, opts = {}) {
        super('SOURCE_ERROR', message, opts);
    }
}
export class AutomationLimitError extends AppError {
    constructor(message, opts = {}) {
        super('AUTOMATION_LIMIT', message, opts);
    }
}
export class InputError extends AppError {
    constructor(message, opts = {}) {
        super('INPUT_ERROR', message, opts);
    }
}
export class UnsupportedError extends AppError {
    constructor(message, opts = {}) {
        super('UNSUPPORTED', message, opts);
    }
}
export class InternalError extends AppError {
    constructor(message, opts = {}) {
        super('INTERNAL', message, opts);
    }
}
export function isAppError(error) {
    return error instanceof AppError;
}
/** Marshal an unknown thrown value to an AppError, preserving known details. */
export function toAppError(error, fallback = 'Unexpected error') {
    if (error instanceof AppError)
        return error;
    if (error instanceof Error) {
        return new InternalError(error.message, { cause: error });
    }
    return new InternalError(fallback, { cause: error });
}
/** Map an AppError to an HTTP status code for API serialization. */
export function appErrorToHttpStatus(error) {
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
//# sourceMappingURL=errors.js.map