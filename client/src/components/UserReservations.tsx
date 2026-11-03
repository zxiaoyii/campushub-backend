import type { Reservation } from '@contract';
import { useUserReservations } from '../hooks/useReservations';
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
  const {
    reservations,
    isLoading,
    error,
    cancellingId,
    reload,
    cancel,
    dismissError,
  } = useUserReservations(userId, refreshToken);

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2>My bookings</h2>
        <button
          type="button"
          className={styles.refresh}
          onClick={reload}
          disabled={isLoading}
        >
          Refresh
        </button>
      </header>

      {error !== null && (
        <ErrorBanner message={error} onDismiss={dismissError} />
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
                  cancel(reservation.id);
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
