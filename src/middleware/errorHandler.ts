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
/**
 * express.json() rejects a malformed or oversized body with an error that
 * carries an HTTP status of its own. Those are client mistakes: reporting one
 * as a 500, and logging its stack, blames the server for a bad request.
 * Checked structurally because body-parser's error types are not exported.
 */
function isClientRequestError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return false;
  }
  const { status } = error;
  return typeof status === 'number' && status >= 400 && status < 500;
}

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

  // Collapsed to 400: the contract documents no other client-error status for
  // a body the server could not read.
  if (isClientRequestError(error)) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message:
        error instanceof Error
          ? error.message
          : 'Request body could not be parsed.',
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
