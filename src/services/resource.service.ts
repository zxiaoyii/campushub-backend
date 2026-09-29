import type { Resource } from '../types/reservation.ts';

/**
 * In-memory resource catalogue.
 *
 * Lab 2 is a contract-verification exercise and explicitly runs without a
 * database, so this module-level array stands in for the Mongoose model that
 * will replace it. Only this layer knows the data is in memory — the
 * controller above it is unaffected when persistence lands.
 */
const RESOURCES: readonly Resource[] = [
  {
    id: 'res-101',
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Snell Library, Floor 3',
    isAvailable: true,
  },
  {
    id: 'res-102',
    name: 'Study Room 415',
    type: 'ROOM',
    location: 'Snell Library, Floor 4',
    isAvailable: true,
  },
  {
    id: 'res-201',
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Makerspace, Curry Student Center',
    isAvailable: true,
  },
  {
    id: 'res-301',
    name: 'Robotics Lab',
    type: 'LAB',
    location: 'Richards Hall 210',
    isAvailable: false,
  },
];

/**
 * Lists resources, optionally narrowed by type. An unrecognised type is not an
 * error: it simply matches nothing, which is what the contract documents.
 */
export function listResources(type?: string): Resource[] {
  if (type === undefined) {
    return [...RESOURCES];
  }
  return RESOURCES.filter(
    (resource: Resource): boolean => resource.type === type,
  );
}

export function findResourceById(resourceId: string): Resource | undefined {
  return RESOURCES.find(
    (resource: Resource): boolean => resource.id === resourceId,
  );
}
