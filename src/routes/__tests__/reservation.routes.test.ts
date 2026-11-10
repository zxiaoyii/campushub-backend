import request from 'supertest';
import { createApp } from '../../app.ts';
import { MISSING_OBJECT_ID, seedResource } from '../../test/factories.ts';
import { jsonBody } from '../../test/http.ts';
import type { ErrorResponse, Reservation } from '../../../shared/contract.ts';

const app = createApp();
const RESERVATIONS = '/api/v1/reservations';

const START = '2026-10-01T10:00:00.000Z';
const END = '2026-10-01T11:00:00.000Z';

function body(
  resourceId: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    resourceId,
    userId: 'user-456',
    startTime: START,
    endTime: END,
    ...overrides,
  };
}

describe('POST /api/v1/reservations', () => {
  it('returns 201 with the created reservation', async (): Promise<void> => {
    const resourceId = await seedResource();

    const response = await request(app)
      .post(RESERVATIONS)
      .send(body(resourceId));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      resourceId,
      userId: 'user-456',
      startTime: START,
      endTime: END,
      status: 'PENDING',
    });
  });

  it('returns 409 DOUBLE_BOOKING on an overlapping window', async (): Promise<void> => {
    const resourceId = await seedResource();
    await request(app).post(RESERVATIONS).send(body(resourceId));

    const response = await request(app)
      .post(RESERVATIONS)
      .send(
        body(resourceId, {
          userId: 'user-789',
          startTime: '2026-10-01T10:30:00.000Z',
          endTime: '2026-10-01T11:30:00.000Z',
        }),
      );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: 'DOUBLE_BOOKING',
      message: expect.any(String) as string,
    });
  });

  it('returns 409 RESOURCE_UNAVAILABLE for a resource that is not bookable', async (): Promise<void> => {
    const resourceId = await seedResource({ isAvailable: false });

    const response = await request(app)
      .post(RESERVATIONS)
      .send(body(resourceId));

    expect(response.status).toBe(409);
    expect(jsonBody<ErrorResponse>(response).code).toBe('RESOURCE_UNAVAILABLE');
  });

  it('returns 404 for a resource that does not exist', async (): Promise<void> => {
    const response = await request(app)
      .post(RESERVATIONS)
      .send(body(MISSING_OBJECT_ID));

    expect(response.status).toBe(404);
    expect(jsonBody<ErrorResponse>(response).code).toBe('RESOURCE_NOT_FOUND');
  });

  describe('rejects a malformed payload with 400', () => {
    const cases: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ['a missing resourceId', { resourceId: undefined }],
      ['an empty userId', { userId: '   ' }],
      ['a non-string userId', { userId: 42 }],
      ['a date-only startTime', { startTime: '2026-10-01' }],
      ['a timestamp with no zone', { startTime: '2026-10-01T10:00:00' }],
      ['an unparseable date', { endTime: 'tomorrow' }],
      ['an endTime before the startTime', { startTime: END, endTime: START }],
      ['a zero-length window', { endTime: START }],
      ['an unexpected property', { tenantId: 'neu' }],
    ];

    it.each(cases)('%s', async (_label, overrides): Promise<void> => {
      const resourceId = await seedResource();

      const response = await request(app)
        .post(RESERVATIONS)
        .send(body(resourceId, overrides));

      expect(response.status).toBe(400);
      expect(jsonBody<ErrorResponse>(response).code).toBe('VALIDATION_ERROR');
    });
  });

  it('returns 400 for a JSON array instead of an object', async (): Promise<void> => {
    const response = await request(app).post(RESERVATIONS).send([]);

    expect(response.status).toBe(400);
    expect(jsonBody<ErrorResponse>(response).code).toBe('VALIDATION_ERROR');
  });

  // A body the parser cannot read is the client's mistake, not a server fault.
  it('returns 400 for a syntactically broken body', async (): Promise<void> => {
    const response = await request(app)
      .post(RESERVATIONS)
      .set('Content-Type', 'application/json')
      .send('{"resourceId":');

    expect(response.status).toBe(400);
    expect(jsonBody<ErrorResponse>(response).code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/reservations/user/{userId}', () => {
  it('returns 200 with that user’s active reservations', async (): Promise<void> => {
    const resourceId = await seedResource();
    await request(app).post(RESERVATIONS).send(body(resourceId));
    await request(app)
      .post(RESERVATIONS)
      .send(body(resourceId, { userId: 'someone-else' }));

    const response = await request(app).get(`${RESERVATIONS}/user/user-456`);

    expect(response.status).toBe(200);
    expect(jsonBody<Reservation[]>(response)).toHaveLength(1);
    expect(jsonBody<Reservation[]>(response)[0]?.userId).toBe('user-456');
  });

  it('returns 400 for a userId that is only whitespace', async (): Promise<void> => {
    const response = await request(app).get(`${RESERVATIONS}/user/%20%20`);

    expect(response.status).toBe(400);
    expect(jsonBody<ErrorResponse>(response).code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 and an empty array for a user with nothing booked', async (): Promise<void> => {
    const response = await request(app).get(`${RESERVATIONS}/user/nobody`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe('PATCH /api/v1/reservations/{id}/confirm and /cancel', () => {
  async function createReservationOverHttp(): Promise<string> {
    const resourceId = await seedResource();
    const response = await request(app)
      .post(RESERVATIONS)
      .send(body(resourceId));
    return jsonBody<Reservation>(response).id;
  }

  it('confirms a pending reservation', async (): Promise<void> => {
    const id = await createReservationOverHttp();

    const response = await request(app).patch(`${RESERVATIONS}/${id}/confirm`);

    expect(response.status).toBe(200);
    expect(jsonBody<Reservation>(response).status).toBe('CONFIRMED');
  });

  it('cancels a pending reservation', async (): Promise<void> => {
    const id = await createReservationOverHttp();

    const response = await request(app).patch(`${RESERVATIONS}/${id}/cancel`);

    expect(response.status).toBe(200);
    expect(jsonBody<Reservation>(response).status).toBe('CANCELLED');
  });

  it('returns 409 when cancelling twice', async (): Promise<void> => {
    const id = await createReservationOverHttp();
    await request(app).patch(`${RESERVATIONS}/${id}/cancel`);

    const response = await request(app).patch(`${RESERVATIONS}/${id}/cancel`);

    expect(response.status).toBe(409);
    expect(jsonBody<ErrorResponse>(response).code).toBe(
      'RESERVATION_NOT_ACTIVE',
    );
  });

  it('returns 409 when confirming a cancelled reservation', async (): Promise<void> => {
    const id = await createReservationOverHttp();
    await request(app).patch(`${RESERVATIONS}/${id}/cancel`);

    const response = await request(app).patch(`${RESERVATIONS}/${id}/confirm`);

    expect(response.status).toBe(409);
    expect(jsonBody<ErrorResponse>(response).code).toBe(
      'RESERVATION_NOT_PENDING',
    );
  });

  it('returns 404 for an id that matches nothing', async (): Promise<void> => {
    const response = await request(app).patch(
      `${RESERVATIONS}/${MISSING_OBJECT_ID}/cancel`,
    );

    expect(response.status).toBe(404);
    expect(jsonBody<ErrorResponse>(response).code).toBe(
      'RESERVATION_NOT_FOUND',
    );
  });

  it('returns 400 for a malformed id', async (): Promise<void> => {
    const response = await request(app).patch(
      `${RESERVATIONS}/not-an-id/confirm`,
    );

    expect(response.status).toBe(400);
    expect(jsonBody<ErrorResponse>(response).code).toBe('VALIDATION_ERROR');
  });
});
