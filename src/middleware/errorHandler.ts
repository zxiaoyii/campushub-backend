import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '../types/domain-error.ts';
import type { ErrorResponse } from '../../shared/contract.ts';

export function notFoundHandler(
  req: Request,
  res: Response<ErrorResponse>,
): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} does not exist.`,
  });
}

/**
 * Centralized error responder: the only place in the application that turns a
 * failure into an HTTP response, so clients always receive the ErrorResponse
 * shape defined in docs/openapi.yaml and internal details are never leaked.
 *
 * Controllers do not catch. Express 5 forwards both a synchronous throw and a
 * rejected promise from a handler to this middleware, so the inline
 * try/catch + next(error) blocks they used to carry were pure duplication.
 *
 * Domain errors carry their own status and code; anything else is an
 * unexpected fault and collapses to a generic 500.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    return;
  }

  if (error instanceof DomainError) {
    res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
    });
    return;
  }

  const detail: string =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error('[error]', detail);

  res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
  });
}
