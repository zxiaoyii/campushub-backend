import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  cancelReservation,
  fetchUserReservations,
} from '../api/campushubApi';
import type { Reservation } from '../types/api';
import { ErrorBanner } from './ErrorBanner';
import styles from './UserReservations.module.css';

export interface UserReservationsProps {
  userId: string;
  refreshToken: number;
}

function formatSlot(reservation: Reservation): string {
  const start = new Date(reservation.startTime);
  const end = new Date(reservation.endTime);
  return `${start.toLocaleString()} → ${end.toLocaleTimeString()}`;
}

export function UserReservations({
  userId,
  refreshToken,
}: UserReservationsProps) {
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
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not load your reservations.',
      );
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  async function handleCancel(reservationId: string): Promise<void> {
    setCancellingId(reservationId);
    setError(null);
    try {
      await cancelReservation(reservationId);
      await load();
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not cancel that reservation.',
      );
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>My bookings</h2>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => {
            void load();
          }}
          disabled={isLoading}
        >
          Refresh
        </button>
      </header>

      {error !== null && (
        <ErrorBanner
          message={error}
          onDismiss={() => {
            setError(null);
          }}
        />
      )}

      {isLoading ? (
        <p className={styles.state}>Loading bookings…</p>
      ) : reservations.length === 0 ? (
        <p className={styles.state}>No active bookings.</p>
      ) : (
        <ul className={styles.list}>
          {reservations.map((reservation) => (
            <li key={reservation.id} className={styles.row}>
              <div className={styles.details}>
                <span className={styles.slot}>{formatSlot(reservation)}</span>
                <span className={styles.meta}>
                  {reservation.status} · resource {reservation.resourceId}
                </span>
              </div>
              <button
                type="button"
                className={styles.cancel}
                disabled={cancellingId === reservation.id}
                onClick={() => {
                  void handleCancel(reservation.id);
                }}
              >
                {cancellingId === reservation.id ? 'Cancelling…' : 'Cancel'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
