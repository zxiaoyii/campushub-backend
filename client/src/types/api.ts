// Mirrors components/schemas in docs/openapi.yaml. The contract is the source
// of truth; change it first, then this file.

export const RESOURCE_TYPES = ['ROOM', 'EQUIPMENT', 'LAB'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

export interface Reservation {
  id: string;
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}

export interface CreateReservationDTO {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
}
