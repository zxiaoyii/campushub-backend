import { useState, type FormEvent } from 'react';
import type { Resource } from '@contract';
import { useCreateReservation } from '../hooks/useReservations';
import { ErrorBanner } from './ErrorBanner';
import styles from './BookingForm.module.css';

export interface BookingFormProps {
  resource: Resource | null;
  userId: string;
  onBooked: () => void;
}

/** datetime-local gives "2026-12-01T10:00"; the API wants full ISO 8601. */
function toIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

export function BookingForm({ resource, userId, onBooked }: BookingFormProps) {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const { isSubmitting, error, success, book, fail, dismissError } =
    useCreateReservation();

  /** Client-side checks, so an obviously bad form never reaches the API. */
  function validate(): string | null {
    if (resource === null) {
      return 'Pick a resource first.';
    }
    if (userId.trim() === '') {
      return 'Enter a student id.';
    }
    if (startTime === '' || endTime === '') {
      return 'Both a start and an end time are required.';
    }
    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      return 'The end time must be after the start time.';
    }
    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const problem = validate();
    if (problem !== null || resource === null) {
      fail(problem ?? 'Pick a resource first.');
      return;
    }

    const booked = await book({
      resourceId: resource.id,
      userId: userId.trim(),
      startTime: toIso(startTime),
      endTime: toIso(endTime),
    });

    if (booked) {
      setStartTime('');
      setEndTime('');
      onBooked();
    }
  }

  return (
    <section className={styles.section}>
      <h2>Book a resource</h2>

      <p className={styles.target}>
        {resource === null ? (
          <span className={styles.muted}>No resource selected.</span>
        ) : (
          <>
            Booking <strong>{resource.name}</strong>
          </>
        )}
      </p>

      {error !== null && (
        <ErrorBanner message={error} onDismiss={dismissError} />
      )}
      {success !== null && <p className={styles.success}>{success}</p>}

      <form
        className={styles.form}
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <label className={styles.field}>
          <span>Start</span>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(event) => {
              setStartTime(event.target.value);
            }}
          />
        </label>

        <label className={styles.field}>
          <span>End</span>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(event) => {
              setEndTime(event.target.value);
            }}
          />
        </label>

        <button
          type="submit"
          className={styles.submit}
          disabled={isSubmitting || resource === null}
        >
          {isSubmitting ? 'Booking…' : 'Request booking'}
        </button>
      </form>
    </section>
  );
}
