import type {
  ErrorResponse,
  Reservation,
  ReservationCreate,
  Resource,
} from '@contract';

const BASE_URL = '/api/v1';

/**
 * An error the backend reported, carrying the contract's { code, message }
 * so components can react to a specific case such as DOUBLE_BOOKING.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }
}

/**
 * Turns anything thrown by this module into text a user can read. Every
 * component used to repeat this instanceof check with its own wording.
 */
export function describeApiError(caught: unknown, fallback: string): string {
  if (!(caught instanceof ApiError)) {
    return fallback;
  }
  return caught.isConflict
    ? `${caught.message} (${caught.code})`
    : caught.message;
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ErrorResponse).code === 'string' &&
    typeof (value as ErrorResponse).message === 'string'
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Could not reach the server. Is the backend running on port 3000?',
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isErrorResponse(body)) {
      throw new ApiError(response.status, body.code, body.message);
    }
    throw new ApiError(
      response.status,
      'UNKNOWN_ERROR',
      `Request failed with status ${String(response.status)}.`,
    );
  }

  return body as T;
}

export function fetchResources(type?: string): Promise<Resource[]> {
  const query = type === undefined ? '' : `?type=${encodeURIComponent(type)}`;
  return request<Resource[]>(`/resources${query}`);
}

export function createReservation(
  payload: ReservationCreate,
): Promise<Reservation> {
  return request<Reservation>('/reservations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchUserReservations(userId: string): Promise<Reservation[]> {
  return request<Reservation[]>(
    `/reservations/user/${encodeURIComponent(userId)}`,
  );
}

export function cancelReservation(reservationId: string): Promise<Reservation> {
  return request<Reservation>(
    `/reservations/${encodeURIComponent(reservationId)}/cancel`,
    { method: 'PATCH' },
  );
}
