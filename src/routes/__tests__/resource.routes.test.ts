import request from 'supertest';
import { createApp } from '../../app.ts';
import { seedResource } from '../../test/factories.ts';
import { jsonBody } from '../../test/http.ts';
import type { ErrorResponse, Resource } from '../../../shared/contract.ts';

const app = createApp();
const RESOURCES = '/api/v1/resources';

describe('GET /api/v1/resources', () => {
  beforeEach(async (): Promise<void> => {
    await seedResource({ name: 'Study Room 302', type: 'ROOM' });
    await seedResource({ name: '3D Printer A', type: 'EQUIPMENT' });
    await seedResource({
      name: 'Robotics Lab',
      type: 'LAB',
      isAvailable: false,
    });
  });

  it('returns 200 with the whole catalogue', async (): Promise<void> => {
    const response = await request(app).get(RESOURCES);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(jsonBody<Resource[]>(response)[0]).toEqual({
      id: expect.any(String) as string,
      name: '3D Printer A',
      type: 'EQUIPMENT',
      location: expect.any(String) as string,
      isAvailable: true,
    });
  });

  it('filters by type', async (): Promise<void> => {
    const response = await request(app).get(RESOURCES).query({ type: 'ROOM' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(jsonBody<Resource[]>(response)[0]?.name).toBe('Study Room 302');
  });

  it('filters by availability', async (): Promise<void> => {
    const response = await request(app)
      .get(RESOURCES)
      .query({ isAvailable: 'false' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(jsonBody<Resource[]>(response)[0]?.name).toBe('Robotics Lab');
  });

  it('combines both filters', async (): Promise<void> => {
    const response = await request(app)
      .get(RESOURCES)
      .query({ type: 'LAB', isAvailable: 'true' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // An unknown type matches nothing; an empty one is a malformed request.
  it('returns 200 and an empty list for a type outside the enum', async (): Promise<void> => {
    const response = await request(app)
      .get(RESOURCES)
      .query({ type: 'SPACESHIP' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns 400 for an empty type', async (): Promise<void> => {
    const response = await request(app).get(`${RESOURCES}?type=`);

    expect(response.status).toBe(400);
    expect(jsonBody<ErrorResponse>(response).code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for a repeated type parameter', async (): Promise<void> => {
    const response = await request(app).get(`${RESOURCES}?type=ROOM&type=LAB`);

    expect(response.status).toBe(400);
    expect(jsonBody<ErrorResponse>(response).code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for an isAvailable value that is not a boolean', async (): Promise<void> => {
    const response = await request(app)
      .get(RESOURCES)
      .query({ isAvailable: 'yes' });

    expect(response.status).toBe(400);
    expect(jsonBody<ErrorResponse>(response).code).toBe('VALIDATION_ERROR');
  });
});

describe('the application shell', () => {
  it('serves the health endpoint', async (): Promise<void> => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'campushub-backend',
    });
  });

  it('returns a contract-shaped 404 for an unknown route', async (): Promise<void> => {
    const response = await request(app).get('/api/v1/nope');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 'NOT_FOUND',
      message: expect.any(String) as string,
    });
  });
});
