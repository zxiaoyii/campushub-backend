import { ResourceModel } from '../models/Resource.model.ts';
import type { ResourceInput } from '../../shared/contract.ts';

const DEFAULT_RESOURCE: ResourceInput = {
  name: 'Study Room 302',
  type: 'ROOM',
  location: 'Snell Library, Floor 3',
  isAvailable: true,
};

/**
 * Inserts one resource and returns its id. Tests that only need "a bookable
 * thing" call it with no arguments; tests about filtering or availability
 * override the fields they care about.
 */
export async function seedResource(
  overrides: Partial<ResourceInput> = {},
): Promise<string> {
  const created = await ResourceModel.create({
    ...DEFAULT_RESOURCE,
    ...overrides,
  });
  return created._id.toString();
}

/** An ObjectId that is well-formed but belongs to no document. */
export const MISSING_OBJECT_ID = '000000000000000000000000';
