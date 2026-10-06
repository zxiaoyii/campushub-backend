import { Schema, model, type Model, type Types } from 'mongoose';
import {
  RESERVATION_STATUSES,
  type ReservationStatus,
} from '../types/reservation.ts';

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

export const ReservationModel: Model<IReservation> = model<IReservation>(
  'Reservation',
  reservationSchema,
);
