import type { NextFunction, Request, Response } from 'express';
import { listResources } from '../services/resource.service.ts';
import { ValidationError } from '../types/domain-error.ts';
import type { Resource } from '../types/reservation.ts';

/**
 * Reads the optional `type` filter. Per the contract it is a non-empty string
 * when present: absent means "no filter", empty or repeated means malformed.
 */
function parseTypeFilter(raw: unknown): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError('type must be a non-empty string when provided.');
  }
  return raw;
}

export function handleListResources(
  req: Request,
  res: Response<Resource[]>,
  next: NextFunction,
): void {
  try {
    const typeFilter = parseTypeFilter(req.query['type']);
    res.status(200).json(listResources(typeFilter));
  } catch (error: unknown) {
    next(error);
  }
}
