import { randomUUID } from 'node:crypto';
import { findResourceById } from './resource.service.ts';
import { ConflictError, NotFoundError } from '../types/domain-error.ts';
import {
  ACTIVE_RESERVATION_STATUSES,
  type Reservation,
  type ReservationCreate,
} from '../types/reservation.ts';

/**
 * In-memory reservation store, standing in for the Mongoose model until
 * persistence lands (Lab 2 runs without a database by design).
 */
const reservations: Reservation[] = [];

function isActive(reservation: Reservation): boolean {
  return ACTIVE_RESERVATION_STATUSES.includes(reservation.status);
}

/**
 * Two half-open intervals [start, end) overlap when each begins before the
 * other ends. Back-to-back slots therefore do not conflict: a booking ending
 * at 11:00 leaves 11:00 free.
 */
function overlaps(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA;
}

/**
 * Creates a reservation after checking that the resource exists and that its
 * slot is free. Throws domain errors; the HTTP layer decides how to render
 * them.
 */
export function createReservation(input: ReservationCreate): Reservation {
  const resource = findResourceById(input.resourceId);
  if (resource === undefined) {
    throw new NotFoundError(
      'RESOURCE_NOT_FOUND',
      `Resource "${input.resourceId}" does not exist.`,
    );
  }

  if (!resource.isAvailable) {
    throw new ConflictError(
      'RESOURCE_UNAVAILABLE',
      `Resource "${input.resourceId}" is not available for booking.`,
    );
  }

  const start = Date.parse(input.startTime);
  const end = Date.parse(input.endTime);

  const clash = reservations.find(
    (existing: Reservation): boolean =>
      existing.resourceId === input.resourceId &&
      isActive(existing) &&
      overlaps(
        start,
        end,
        Date.parse(existing.startTime),
        Date.parse(existing.endTime),
      ),
  );

  if (clash !== undefined) {
    throw new ConflictError(
      'DOUBLE_BOOKING',
      'Resource is already reserved for this time slot.',
    );
  }

  const reservation: Reservation = {
    id: `rsv-${randomUUID()}`,
    resourceId: input.resourceId,
    userId: input.userId,
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
    status: 'PENDING',
  };

  reservations.push(reservation);
  return reservation;
}

/** Returns the user's reservations that still hold a slot. */
export function listActiveReservationsForUser(userId: string): Reservation[] {
  return reservations.filter(
    (reservation: Reservation): boolean =>
      reservation.userId === userId && isActive(reservation),
  );
}
