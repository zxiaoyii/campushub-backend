import {
  cancelReservation,
  clearReservations,
  confirmReservation,
  createReservation,
  listActiveReservationsForUser,
} from '../reservation.service.ts';
import { MISSING_OBJECT_ID, seedResource } from '../../test/factories.ts';
import type { ReservationCreate } from '../../../shared/contract.ts';

/** 10:00–11:00 UTC on a fixed day. Every window below is relative to this. */
const START = '2026-10-01T10:00:00.000Z';
const END = '2026-10-01T11:00:00.000Z';

function booking(
  resourceId: string,
  overrides: Partial<ReservationCreate> = {},
): ReservationCreate {
  return {
    resourceId,
    userId: 'user-456',
    startTime: START,
    endTime: END,
    ...overrides,
  };
}

/** Shifts an ISO timestamp by a number of milliseconds. */
function shift(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

describe('createReservation — happy path', () => {
  it('creates a PENDING reservation in the contract shape', async (): Promise<void> => {
    const resourceId = await seedResource();

    const reservation = await createReservation(booking(resourceId));

    expect(reservation).toEqual({
      id: expect.any(String) as string,
      resourceId,
      userId: 'user-456',
      startTime: START,
      endTime: END,
      status: 'PENDING',
    });
  });

  it('allows the same window on a different resource', async (): Promise<void> => {
    const first = await seedResource({ name: 'Study Room 302' });
    const second = await seedResource({ name: 'Study Room 415' });

    await createReservation(booking(first));

    await expect(createReservation(booking(second))).resolves.toMatchObject({
      resourceId: second,
    });
  });

  it('allows a later, non-overlapping window on the same resource', async (): Promise<void> => {
    const resourceId = await seedResource();
    await createReservation(booking(resourceId));

    await expect(
      createReservation(
        booking(resourceId, {
          startTime: '2026-10-01T13:00:00.000Z',
          endTime: '2026-10-01T14:00:00.000Z',
        }),
      ),
    ).resolves.toMatchObject({ status: 'PENDING' });
  });

  // Half-open intervals: a slot ending at 11:00 leaves 11:00 bookable.
  it('allows a booking that starts exactly when another ends', async (): Promise<void> => {
    const resourceId = await seedResource();
    await createReservation(booking(resourceId));

    await expect(
      createReservation(
        booking(resourceId, { startTime: END, endTime: shift(END, 3_600_000) }),
      ),
    ).resolves.toMatchObject({ startTime: END });
  });
});

describe('createReservation — overlap detection', () => {
  let resourceId: string;

  beforeEach(async (): Promise<void> => {
    resourceId = await seedResource();
    await createReservation(booking(resourceId));
  });

  it('rejects an exact start and end match', async (): Promise<void> => {
    await expect(
      createReservation(booking(resourceId, { userId: 'user-789' })),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'DOUBLE_BOOKING',
    });
  });

  it('rejects an overlap of a single millisecond at the start', async (): Promise<void> => {
    await expect(
      createReservation(
        booking(resourceId, {
          startTime: shift(START, -3_600_000),
          endTime: shift(START, 1),
        }),
      ),
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOKING' });
  });

  it('rejects an overlap of a single millisecond at the end', async (): Promise<void> => {
    await expect(
      createReservation(
        booking(resourceId, {
          startTime: shift(END, -1),
          endTime: shift(END, 3_600_000),
        }),
      ),
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOKING' });
  });

  it('rejects a window fully inside the existing one', async (): Promise<void> => {
    await expect(
      createReservation(
        booking(resourceId, {
          startTime: '2026-10-01T10:15:00.000Z',
          endTime: '2026-10-01T10:45:00.000Z',
        }),
      ),
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOKING' });
  });

  it('rejects a window that fully contains the existing one', async (): Promise<void> => {
    await expect(
      createReservation(
        booking(resourceId, {
          startTime: '2026-10-01T09:00:00.000Z',
          endTime: '2026-10-01T12:00:00.000Z',
        }),
      ),
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOKING' });
  });

  it('misses the slot by a millisecond and is accepted', async (): Promise<void> => {
    await expect(
      createReservation(
        booking(resourceId, {
          startTime: shift(START, -3_600_000),
          endTime: START,
        }),
      ),
    ).resolves.toMatchObject({ endTime: START });
  });

  it('still blocks the slot once the reservation is CONFIRMED', async (): Promise<void> => {
    const [existing] = await listActiveReservationsForUser('user-456');
    await confirmReservation(existing?.id ?? '');

    await expect(
      createReservation(booking(resourceId, { userId: 'user-789' })),
    ).rejects.toMatchObject({ code: 'DOUBLE_BOOKING' });
  });

  it('frees the slot once the reservation is CANCELLED', async (): Promise<void> => {
    const [existing] = await listActiveReservationsForUser('user-456');
    await cancelReservation(existing?.id ?? '');

    await expect(
      createReservation(booking(resourceId, { userId: 'user-789' })),
    ).resolves.toMatchObject({ status: 'PENDING' });
  });
});

describe('createReservation — invalid input', () => {
  it('rejects an endTime before the startTime', async (): Promise<void> => {
    const resourceId = await seedResource();

    await expect(
      createReservation(
        booking(resourceId, { startTime: END, endTime: START }),
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects a zero-length window', async (): Promise<void> => {
    const resourceId = await seedResource();

    await expect(
      createReservation(booking(resourceId, { endTime: START })),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects an unparseable date', async (): Promise<void> => {
    const resourceId = await seedResource();

    await expect(
      createReservation(booking(resourceId, { startTime: 'yesterday' })),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  // The window is checked before the lookup, so a reversed range on an unknown
  // resource is still a 400 rather than a 404.
  it('reports a reversed window before it reports a missing resource', async (): Promise<void> => {
    await expect(
      createReservation(
        booking(MISSING_OBJECT_ID, { startTime: END, endTime: START }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a malformed resourceId without reaching the database', async (): Promise<void> => {
    await expect(
      createReservation(booking('not-an-object-id')),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('reports a well-formed resourceId that matches nothing as 404', async (): Promise<void> => {
    await expect(
      createReservation(booking(MISSING_OBJECT_ID)),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  /**
   * A schema violation is not a domain error, so the service must let it
   * through untranslated rather than dressing it up as a 409.
   */
  it('lets an unexpected persistence failure travel untouched', async (): Promise<void> => {
    const resourceId = await seedResource();

    const failure: unknown = await createReservation(
      booking(resourceId, { userId: '' }),
    ).catch((error: unknown): unknown => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toHaveProperty('statusCode');
    expect(String(failure)).toContain('userId');
  });

  it('refuses to book a resource marked unavailable', async (): Promise<void> => {
    const resourceId = await seedResource({ isAvailable: false });

    await expect(createReservation(booking(resourceId))).rejects.toMatchObject({
      statusCode: 409,
      code: 'RESOURCE_UNAVAILABLE',
    });
  });
});

describe('createReservation — concurrent attempts', () => {
  /**
   * The overlap check is a read followed by a write, so three simultaneous
   * requests all pass the read. Only the unique slot index on the model stops
   * the duplicates from landing.
   */
  it('accepts exactly one of three simultaneous identical bookings', async (): Promise<void> => {
    const resourceId = await seedResource();

    const results = await Promise.allSettled([
      createReservation(booking(resourceId, { userId: 'user-1' })),
      createReservation(booking(resourceId, { userId: 'user-2' })),
      createReservation(booking(resourceId, { userId: 'user-3' })),
    ]);

    const accepted = results.filter(
      (result): boolean => result.status === 'fulfilled',
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    for (const failure of rejected) {
      expect(failure.reason).toMatchObject({ code: 'DOUBLE_BOOKING' });
    }
  });
});

describe('listActiveReservationsForUser', () => {
  it('returns only that user’s reservations, earliest first', async (): Promise<void> => {
    const resourceId = await seedResource();
    await createReservation(
      booking(resourceId, {
        startTime: '2026-10-01T15:00:00.000Z',
        endTime: '2026-10-01T16:00:00.000Z',
      }),
    );
    await createReservation(booking(resourceId));
    await createReservation(
      booking(resourceId, {
        userId: 'someone-else',
        startTime: '2026-10-02T10:00:00.000Z',
        endTime: '2026-10-02T11:00:00.000Z',
      }),
    );

    const reservations = await listActiveReservationsForUser('user-456');

    expect(reservations).toHaveLength(2);
    expect(reservations.map((reservation) => reservation.startTime)).toEqual([
      START,
      '2026-10-01T15:00:00.000Z',
    ]);
  });

  it('omits cancelled reservations', async (): Promise<void> => {
    const resourceId = await seedResource();
    const created = await createReservation(booking(resourceId));
    await cancelReservation(created.id);

    expect(await listActiveReservationsForUser('user-456')).toEqual([]);
  });

  it('returns an empty list for a user with nothing booked', async (): Promise<void> => {
    expect(await listActiveReservationsForUser('nobody')).toEqual([]);
  });
});

describe('cancelReservation', () => {
  it('moves a PENDING reservation to CANCELLED', async (): Promise<void> => {
    const resourceId = await seedResource();
    const created = await createReservation(booking(resourceId));

    await expect(cancelReservation(created.id)).resolves.toMatchObject({
      id: created.id,
      status: 'CANCELLED',
    });
  });

  it('cancels a CONFIRMED reservation too', async (): Promise<void> => {
    const resourceId = await seedResource();
    const created = await createReservation(booking(resourceId));
    await confirmReservation(created.id);

    await expect(cancelReservation(created.id)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
  });

  it('rejects a second cancellation', async (): Promise<void> => {
    const resourceId = await seedResource();
    const created = await createReservation(booking(resourceId));
    await cancelReservation(created.id);

    await expect(cancelReservation(created.id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'RESERVATION_NOT_ACTIVE',
    });
  });

  it('rejects a malformed id', async (): Promise<void> => {
    await expect(cancelReservation('nope')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('reports an unknown id as 404', async (): Promise<void> => {
    await expect(cancelReservation(MISSING_OBJECT_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'RESERVATION_NOT_FOUND',
    });
  });
});

describe('confirmReservation', () => {
  it('moves a PENDING reservation to CONFIRMED', async (): Promise<void> => {
    const resourceId = await seedResource();
    const created = await createReservation(booking(resourceId));

    await expect(confirmReservation(created.id)).resolves.toMatchObject({
      status: 'CONFIRMED',
    });
  });

  it('rejects confirming the same reservation twice', async (): Promise<void> => {
    const resourceId = await seedResource();
    const created = await createReservation(booking(resourceId));
    await confirmReservation(created.id);

    await expect(confirmReservation(created.id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'RESERVATION_NOT_PENDING',
    });
  });

  it('refuses to confirm a cancelled reservation', async (): Promise<void> => {
    const resourceId = await seedResource();
    const created = await createReservation(booking(resourceId));
    await cancelReservation(created.id);

    await expect(confirmReservation(created.id)).rejects.toMatchObject({
      code: 'RESERVATION_NOT_PENDING',
    });
  });

  it('rejects a malformed id', async (): Promise<void> => {
    await expect(confirmReservation('nope')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('reports an unknown id as 404', async (): Promise<void> => {
    await expect(confirmReservation(MISSING_OBJECT_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('clearReservations', () => {
  it('removes every reservation and reports how many went', async (): Promise<void> => {
    const resourceId = await seedResource();
    await createReservation(booking(resourceId));
    await createReservation(
      booking(resourceId, {
        startTime: '2026-10-02T10:00:00.000Z',
        endTime: '2026-10-02T11:00:00.000Z',
      }),
    );

    expect(await clearReservations()).toBe(2);
    expect(await listActiveReservationsForUser('user-456')).toEqual([]);
  });

  it('reports zero on an empty collection', async (): Promise<void> => {
    expect(await clearReservations()).toBe(0);
  });
});
