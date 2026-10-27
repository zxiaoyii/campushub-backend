import { useState, type FormEvent } from 'react';
import { ApiError, createReservation } from '../api/campushubApi';
import type { Resource } from '../types/api';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    setSuccess(null);

    const problem = validate();
    if (problem !== null) {
      setError(problem);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const reservation = await createReservation({
        resourceId: resource!.id,
        userId: userId.trim(),
        startTime: toIso(startTime),
        endTime: toIso(endTime),
      });
      setSuccess(
        `Booked. Reservation ${reservation.id} is ${reservation.status}.`,
      );
      setStartTime('');
      setEndTime('');
      onBooked();
    } catch (caught: unknown) {
      if (caught instanceof ApiError) {
        setError(
          caught.isConflict
            ? `This resource is already reserved for the selected time window. (${caught.code})`
            : caught.message,
        );
      } else {
        setError('Something went wrong while creating the reservation.');
      }
    } finally {
      setIsSubmitting(false);
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
        <ErrorBanner
          message={error}
          onDismiss={() => {
            setError(null);
          }}
        />
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
