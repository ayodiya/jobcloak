import { appErrorToHttpStatus, isAppError } from '@jobs-app/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Fastify error handler: serialize semantic AppErrors into stable JSON shapes.
 * Anything else is logged and returned as 500 without leaking internals.
 */
export function makeErrorHandler(opts: { log: (obj: object, msg: string) => void }) {
  return async function errorHandler(
    error: Error & { validation?: unknown; statusCode?: number },
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (isAppError(error)) {
      const status = statusCode ?? appErrorToHttpStatus(error);
      return reply.status(status).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? undefined,
        },
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.message, details: { validation: error.validation } },
      });
    }

    opts.log({ err: error }, 'unhandled error');
    const status = statusCode ?? 500;
    return reply.status(status).send({
      error: { code: 'INTERNAL', message: status >= 500 ? 'Internal server error' : error.message },
    });
  };
}