import type { FastifyInstance, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import type { ApiError, ApiErrorCode } from '@pixel-packs/shared';

/** An error with an API code; thrown from handlers and turned into `{ error }` JSON. */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function sendError(
  reply: FastifyReply,
  status: number,
  code: ApiErrorCode,
  message: string,
) {
  const body: ApiError = { error: { code, message } };
  return reply.status(status).send(body);
}

function statusOf(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const s = err.statusCode;
    if (typeof s === 'number') return s;
  }
  return undefined;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) return sendError(reply, err.statusCode, err.code, err.message);
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const where = first?.path.join('.') ?? '';
      return sendError(
        reply,
        400,
        'badRequest',
        `${where ? `${where}: ` : ''}${first?.message ?? 'Invalid input'}`,
      );
    }
    const status = statusOf(err);
    if (status === 429)
      return sendError(reply, 429, 'rateLimited', 'Too many requests, try again later.');
    if (status !== undefined && status >= 400 && status < 500) {
      return sendError(reply, status, 'badRequest', 'Invalid request.');
    }
    req.log.error(err);
    return sendError(reply, 500, 'internal', 'Something went wrong.');
  });
  app.setNotFoundHandler((_req, reply) => sendError(reply, 404, 'notFound', 'Not found.'));
}
