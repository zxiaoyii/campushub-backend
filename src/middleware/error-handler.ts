import type { NextFunction, Request, Response } from 'express';
import type { ErrorResponse } from '../types/error.ts';

export function notFoundHandler(
  req: Request,
  res: Response<ErrorResponse>,
): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} does not exist.`,
    },
  });
}

/**
 * Centralized error responder. Every controller forwards failures here via
 * next(error) so that clients receive a consistent shape and internal details
 * are never leaked.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction,
): void {
  const detail: string =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error('[error]', detail);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
}
