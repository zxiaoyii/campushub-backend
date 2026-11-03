import { useCallback, useEffect, useState } from 'react';
import type { Reservation, ReservationCreate } from '@contract';
import {
  cancelReservation,
  createReservation,
  describeApiError,
  fetchUserReservations,
} from '../api/campushubApi';

export interface UserReservationsState {
  readonly reservations: Reservation[];
  readonly isLoading: boolean;
  readonly error: string | null;
  /** Id of the reservation currently being cancelled, if any. */
  readonly cancellingId: string | null;
  readonly reload: () => void;
  readonly cancel: (reservationId: string) => void;
  readonly dismissError: () => void;
}

/**
 * Owns the list of a student's active bookings: the fetch, the cancel, and the
 * loading and error state around both. Reloads whenever the student id changes
 * or `refreshToken` is bumped by another part of the page.
 */
export function useUserReservations(
  userId: string,
  refreshToken: number,
): UserReservationsState {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (userId.trim() === '') {
      setReservations([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setReservations(await fetchUserReservations(userId.trim()));
    } catch (caught: unknown) {
      setError(describeApiError(caught, 'Could not load your reservations.'));
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const cancel = useCallback(
    (reservationId: string): void => {
      const run = async (): Promise<void> => {
        setCancellingId(reservationId);
        setError(null);
        try {
          await cancelReservation(reservationId);
          await load();
        } catch (caught: unknown) {
          setError(describeApiError(caught, 'Could not cancel that booking.'));
        } finally {
          setCancellingId(null);
        }
      };
      void run();
    },
    [load],
  );

  return {
    reservations,
    isLoading,
    error,
    cancellingId,
    reload: () => {
      void load();
    },
    cancel,
    dismissError: () => {
      setError(null);
    },
  };
}

export interface CreateReservationState {
  readonly isSubmitting: boolean;
  readonly error: string | null;
  readonly success: string | null;
  readonly book: (payload: ReservationCreate) => Promise<boolean>;
  readonly fail: (message: string) => void;
  readonly dismissError: () => void;
}

/**
 * Owns the POST /reservations call and its outcome. `book` resolves to whether
 * the booking was created, so the caller can clear its form on success without
 * duplicating the error handling.
 */
export function useCreateReservation(): CreateReservationState {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const book = useCallback(
    async (payload: ReservationCreate): Promise<boolean> => {
      setError(null);
      setSuccess(null);
      setIsSubmitting(true);
      try {
        const reservation = await createReservation(payload);
        setSuccess(
          `Booked. Reservation ${reservation.id} is ${reservation.status}.`,
        );
        return true;
      } catch (caught: unknown) {
        setError(
          describeApiError(
            caught,
            'Something went wrong while creating the reservation.',
          ),
        );
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return {
    isSubmitting,
    error,
    success,
    book,
    fail: (message: string) => {
      setSuccess(null);
      setError(message);
    },
    dismissError: () => {
      setError(null);
    },
  };
}
