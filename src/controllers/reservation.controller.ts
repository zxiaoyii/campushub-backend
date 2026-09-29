import type { NextFunction, Request, Response } from 'express';
import {
  createReservation,
  listActiveReservationsForUser,
} from '../services/reservation.service.ts';
import { ValidationError } from '../types/domain-error.ts';
import type { Reservation, ReservationCreate } from '../types/reservation.ts';

/** Fields the contract allows in a ReservationCreate body. */
const ALLOWED_FIELDS = ['resourceId', 'userId', 'startTime', 'endTime'];

/**
 * ISO 8601 date-time, matching `format: date-time` in the contract. Date.parse
 * alone is too permissive — it accepts "2026-10-01" and other shapes the
 * contract does not — so the string is pattern-checked first.
 */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} must be a non-empty string.`);
  }
  return value;
}

function requireIsoDateTime(
  body: Record<string, unknown>,
  field: string,
): string {
  const value = requireString(body, field);
  if (!ISO_DATE_TIME.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ValidationError(
      `${field} must be an ISO 8601 date-time string, for example 2026-10-01T10:00:00Z.`,
    );
  }
  return value;
}

/** Validates the request body against components/schemas/ReservationCreate. */
function parseReservationCreate(payload: unknown): ReservationCreate {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new ValidationError('Request body must be a JSON object.');
  }

  const body = payload as Record<string, unknown>;

  // additionalProperties: false in the contract.
  const unknownField = Object.keys(body).find(
    (key: string): boolean => !ALLOWED_FIELDS.includes(key),
  );
  if (unknownField !== undefined) {
    throw new ValidationError(`Unexpected property "${unknownField}".`);
  }

  const startTime = requireIsoDateTime(body, 'startTime');
  const endTime = requireIsoDateTime(body, 'endTime');

  if (Date.parse(endTime) <= Date.parse(startTime)) {
    throw new ValidationError('endTime must be after startTime.');
  }

  return {
    resourceId: requireString(body, 'resourceId'),
    userId: requireString(body, 'userId'),
    startTime,
    endTime,
  };
}

export function handleCreateReservation(
  req: Request,
  res: Response<Reservation>,
  next: NextFunction,
): void {
  try {
    const input: ReservationCreate = parseReservationCreate(req.body);
    res.status(201).json(createReservation(input));
  } catch (error: unknown) {
    next(error);
  }
}

export function handleListUserReservations(
  req: Request<{ userId: string }>,
  res: Response<Reservation[]>,
  next: NextFunction,
): void {
  try {
    const { userId } = req.params;
    if (userId.trim() === '') {
      throw new ValidationError('userId must be a non-empty string.');
    }
    res.status(200).json(listActiveReservationsForUser(userId));
  } catch (error: unknown) {
    next(error);
  }
}
