/**
 * Types generated from docs/openapi.yaml. The contract is authoritative: field
 * names, enum members and optionality here mirror components/schemas exactly.
 * Change the contract first, then this file.
 */

/** components/schemas/ResourceType */
export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** components/schemas/ReservationStatus */
export const RESERVATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Statuses that still occupy a time slot. */
export const ACTIVE_RESERVATION_STATUSES: readonly ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
];

/** components/schemas/Resource */
export interface Resource {
  readonly id: string;
  readonly name: string;
  readonly type: ResourceType;
  readonly location: string;
  readonly isAvailable: boolean;
}

/** components/schemas/Reservation */
export interface Reservation {
  readonly id: string;
  readonly resourceId: string;
  readonly userId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: ReservationStatus;
}

/**
 * components/schemas/ReservationCreate — the client-supplied half of a
 * reservation. `id` and `status` are assigned by the server.
 */
export interface ReservationCreate {
  readonly resourceId: string;
  readonly userId: string;
  readonly startTime: string;
  readonly endTime: string;
}

/** A resource before it has been persisted and assigned an id. */
export type ResourceInput = Omit<Resource, 'id'>;

/** Query parameters accepted by GET /resources. */
export interface ListResourcesQuery {
  readonly type?: string;
}
