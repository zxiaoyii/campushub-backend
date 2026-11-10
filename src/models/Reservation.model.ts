import { Schema, model, type Model, type Types } from 'mongoose';
import {
  ACTIVE_RESERVATION_STATUSES,
  RESERVATION_STATUSES,
  type ReservationStatus,
} from '../../shared/contract.ts';

export interface IReservation {
  resourceId: Types.ObjectId;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
}

const reservationSchema = new Schema<IReservation>(
  {
    resourceId: {
      type: Schema.Types.ObjectId,
      ref: 'Resource',
      required: true,
    },
    userId: { type: String, required: true, trim: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: [...RESERVATION_STATUSES],
      default: 'PENDING',
    },
  },
  { timestamps: true, versionKey: false },
);

// Supports the overlap lookup done on every create.
reservationSchema.index({ resourceId: 1, status: 1, startTime: 1 });
reservationSchema.index({ userId: 1, status: 1 });

/**
 * Closes the double-submit race. The overlap check in the service is a read
 * followed by a write, so two concurrent requests for the same window can both
 * pass the read. This index makes the identical-slot case impossible to
 * duplicate: the second insert fails with a duplicate-key error, which the
 * service reports as DOUBLE_BOOKING.
 *
 * Partial on the active statuses, so cancelling a booking frees the slot for
 * the same window again.
 */
reservationSchema.index(
  { resourceId: 1, startTime: 1, endTime: 1 },
  {
    unique: true,
    name: 'unique_active_slot',
    partialFilterExpression: {
      status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
    },
  },
);

export const ReservationModel: Model<IReservation> = model<IReservation>(
  'Reservation',
  reservationSchema,
);
