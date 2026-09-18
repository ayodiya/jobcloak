import { describe, expect, it } from 'vitest';
import {
  AIProviderError,
  AIValidationError,
  AppError,
  AutomationLimitError,
  DatabaseError,
  NotFoundError,
  ValidationError,
  appErrorToHttpStatus,
  isAppError,
  toAppError,
} from './errors.js';

describe('AppError hierarchy', () => {
  it('exposes stable machine-readable codes', () => {
    expect(new ValidationError('bad').code).toBe('VALIDATION_ERROR');
    expect(new NotFoundError('nope').code).toBe('NOT_FOUND');
    expect(new AIProviderError('down').code).toBe('AI_PROVIDER_ERROR');
    expect(new AIValidationError('malformed').code).toBe('AI_VALIDATION_ERROR');
    expect(new DatabaseError('down').code).toBe('DATABASE_ERROR');
    expect(new AutomationLimitError('daily limit').code).toBe('AUTOMATION_LIMIT');
  });

  it('carries structured details and a cause', () => {
    const cause = new Error('root cause');
    const err = new AppError('VALIDATION_ERROR', 'bad input', { cause, details: { field: 'title' } });
    expect(err.details).toEqual({ field: 'title' });
    expect(err.cause).toBe(cause);
    expect(err.toJSON()).toMatchObject({ code: 'VALIDATION_ERROR', message: 'bad input' });
  });

  it('isAppError distinguishes semantic errors', () => {
    expect(isAppError(new ValidationError('x'))).toBe(true);
    expect(isAppError(new Error('x'))).toBe(false);
    expect(isAppError('string')).toBe(false);
  });

  it('toAppError preserves existing AppErrors', () => {
    const original = new ValidationError('keep me');
    expect(toAppError(original)).toBe(original);
  });

  it('toAppError wraps unknown errors with details', () => {
    const wrapped = toAppError(new Error('boom'), 'fallback');
    expect(wrapped.code).toBe('INTERNAL');
    expect(wrapped.message).toBe('boom');
    expect(isAppError(wrapped)).toBe(true);
  });

  it('maps semantic codes to HTTP statuses', () => {
    expect(appErrorToHttpStatus(new ValidationError('x'))).toBe(400);
    expect(appErrorToHttpStatus(new NotFoundError('x'))).toBe(404);
    expect(appErrorToHttpStatus(new AutomationLimitError('x'))).toBe(409);
  });
});