import type { NextFunction, Request, Response } from 'express';
import {
  listResources,
  type ResourceFilter,
} from '../services/resource.service.ts';
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

/** Query strings carry no booleans, so only "true" and "false" are accepted. */
function parseIsAvailableFilter(raw: unknown): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  throw new ValidationError('isAvailable must be either "true" or "false".');
}

export async function handleListResources(
  req: Request,
  res: Response<Resource[]>,
  next: NextFunction,
): Promise<void> {
  try {
    const type = parseTypeFilter(req.query['type']);
    const isAvailable = parseIsAvailableFilter(req.query['isAvailable']);

    const criteria: ResourceFilter = {
      ...(type === undefined ? {} : { type }),
      ...(isAvailable === undefined ? {} : { isAvailable }),
    };

    res.status(200).json(await listResources(criteria));
  } catch (error: unknown) {
    next(error);
  }
}
