import { isValidObjectId, type HydratedDocument, type Types } from 'mongoose';
import {
  ReservationModel,
  type IReservation,
} from '../models/Reservation.model.ts';
import { ResourceModel } from '../models/Resource.model.ts';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../types/domain-error.ts';
import {
  ACTIVE_RESERVATION_STATUSES,
  type Reservation,
  type ReservationCreate,
} from '../types/reservation.ts';

/** The persisted fields this layer reads back, independent of Mongoose's document wrappers. */
interface ReservationRecord extends IReservation {
  _id: Types.ObjectId;
}

function toReservation(record: ReservationRecord): Reservation {
  return {
    id: record._id.toString(),
    resourceId: record.resourceId.toString(),
    userId: record.userId,
    startTime: record.startTime.toISOString(),
    endTime: record.endTime.toISOString(),
    status: record.status,
  };
}

export async function createReservation(
  input: ReservationCreate,
): Promise<Reservation> {
  if (!isValidObjectId(input.resourceId)) {
    throw new ValidationError(
      'resourceId must be a valid resource identifier.',
    );
  }

  const resource = await ResourceModel.findById(input.resourceId).exec();
  if (resource === null) {
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

  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);

  // Half-open intervals: a slot ending at 11:00 leaves 11:00 bookable.
  const clash = await ReservationModel.exists({
    resourceId: resource._id,
    status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  }).exec();

  if (clash !== null) {
    throw new ConflictError(
      'DOUBLE_BOOKING',
      'Resource is already reserved for this time slot.',
    );
  }

  const created = await ReservationModel.create({
    resourceId: resource._id,
    userId: input.userId,
    startTime,
    endTime,
    status: 'PENDING',
  });

  return toReservation(created);
}

export async function listActiveReservationsForUser(
  userId: string,
): Promise<Reservation[]> {
  const documents = await ReservationModel.find({
    userId,
    status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
  })
    .sort({ startTime: 1 })
    .lean<ReservationRecord[]>()
    .exec();

  return documents.map(toReservation);
}

async function loadReservation(
  reservationId: string,
): Promise<HydratedDocument<IReservation>> {
  if (!isValidObjectId(reservationId)) {
    throw new ValidationError(
      'reservationId must be a valid reservation identifier.',
    );
  }

  const reservation = await ReservationModel.findById(reservationId).exec();
  if (reservation === null) {
    throw new NotFoundError(
      'RESERVATION_NOT_FOUND',
      `Reservation "${reservationId}" does not exist.`,
    );
  }

  return reservation;
}

/**
 * Moves a reservation to CANCELLED. The slot is freed as a side effect: the
 * overlap check only looks at PENDING and CONFIRMED rows.
 */
export async function cancelReservation(
  reservationId: string,
): Promise<Reservation> {
  const reservation = await loadReservation(reservationId);

  if (reservation.status === 'CANCELLED') {
    throw new ConflictError(
      'RESERVATION_NOT_ACTIVE',
      'Reservation is already cancelled.',
    );
  }

  reservation.status = 'CANCELLED';
  await reservation.save();

  return toReservation(reservation);
}

/** Moves a PENDING reservation to CONFIRMED. The slot stays occupied. */
export async function confirmReservation(
  reservationId: string,
): Promise<Reservation> {
  const reservation = await loadReservation(reservationId);

  if (reservation.status !== 'PENDING') {
    throw new ConflictError(
      'RESERVATION_NOT_PENDING',
      `Only a PENDING reservation can be confirmed; this one is ${reservation.status}.`,
    );
  }

  reservation.status = 'CONFIRMED';
  await reservation.save();

  return toReservation(reservation);
}

/**
 * Removes every reservation. Used by the seed script: reseeding assigns new
 * resource ids, so reservations left behind would point at resources that no
 * longer exist.
 */
export async function clearReservations(): Promise<number> {
  const result = await ReservationModel.deleteMany({}).exec();
  return result.deletedCount;
}
