import {
  findResourceById,
  listResources,
  replaceResourceCatalogue,
} from '../resource.service.ts';
import { MISSING_OBJECT_ID, seedResource } from '../../test/factories.ts';

describe('listResources', () => {
  beforeEach(async (): Promise<void> => {
    await seedResource({ name: 'Study Room 302', type: 'ROOM' });
    await seedResource({ name: '3D Printer A', type: 'EQUIPMENT' });
    await seedResource({
      name: 'Robotics Lab',
      type: 'LAB',
      isAvailable: false,
    });
  });

  it('returns the whole catalogue sorted by name when no filter is given', async (): Promise<void> => {
    const resources = await listResources();

    expect(resources.map((resource) => resource.name)).toEqual([
      '3D Printer A',
      'Robotics Lab',
      'Study Room 302',
    ]);
  });

  it('filters by type', async (): Promise<void> => {
    const resources = await listResources({ type: 'ROOM' });

    expect(resources).toHaveLength(1);
    expect(resources[0]?.type).toBe('ROOM');
  });

  it('filters by availability', async (): Promise<void> => {
    const available = await listResources({ isAvailable: true });
    const unavailable = await listResources({ isAvailable: false });

    expect(available).toHaveLength(2);
    expect(unavailable.map((resource) => resource.name)).toEqual([
      'Robotics Lab',
    ]);
  });

  it('combines both filters', async (): Promise<void> => {
    expect(await listResources({ type: 'LAB', isAvailable: true })).toEqual([]);
    expect(
      await listResources({ type: 'LAB', isAvailable: false }),
    ).toHaveLength(1);
  });

  // The contract documents an unknown type as "matches nothing", not as an
  // error, and the service short-circuits before touching the database.
  it('returns an empty list for a type outside the contract enum', async (): Promise<void> => {
    expect(await listResources({ type: 'SPACESHIP' })).toEqual([]);
  });

  it('treats the type filter as case-sensitive', async (): Promise<void> => {
    expect(await listResources({ type: 'room' })).toEqual([]);
  });
});

describe('findResourceById', () => {
  it('returns the resource for a known id', async (): Promise<void> => {
    const id = await seedResource({ name: 'Study Room 415' });

    const resource = await findResourceById(id);

    expect(resource?.id).toBe(id);
    expect(resource?.name).toBe('Study Room 415');
  });

  it('returns null for a well-formed id that matches nothing', async (): Promise<void> => {
    expect(await findResourceById(MISSING_OBJECT_ID)).toBeNull();
  });

  // A malformed id must not reach Mongoose, which would throw a CastError.
  it('returns null for a malformed id', async (): Promise<void> => {
    expect(await findResourceById('not-an-object-id')).toBeNull();
  });
});

describe('replaceResourceCatalogue', () => {
  it('removes what was there and inserts the new catalogue', async (): Promise<void> => {
    await seedResource({ name: 'Old Room' });

    const created = await replaceResourceCatalogue([
      {
        name: 'New Room',
        type: 'ROOM',
        location: 'Curry Student Center',
        isAvailable: true,
      },
    ]);

    expect(created).toHaveLength(1);
    expect(created[0]?.name).toBe('New Room');
    expect((await listResources()).map((resource) => resource.name)).toEqual([
      'New Room',
    ]);
  });

  it('accepts an empty catalogue and clears the collection', async (): Promise<void> => {
    await seedResource();

    expect(await replaceResourceCatalogue([])).toEqual([]);
    expect(await listResources()).toEqual([]);
  });
});
