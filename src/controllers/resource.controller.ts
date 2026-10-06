import type { NextFunction, Request, Response } from 'express';
import { listResources } from '../services/resource.service.ts';
import { ValidationError } from '../types/domain-error.ts';
import type { Resource } from '../types/reservation.ts';

/** Absent means no filter; empty or repeated is a malformed request. */
function parseTypeFilter(raw: unknown): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new ValidationError('type must be a non-empty string when provided.');
  }
  return raw;
}

export async function handleListResources(
  req: Request,
  res: Response<Resource[]>,
  next: NextFunction,
): Promise<void> {
  try {
    const typeFilter = parseTypeFilter(req.query['type']);
    res.status(200).json(await listResources(typeFilter));
  } catch (error: unknown) {
    next(error);
  }
}
