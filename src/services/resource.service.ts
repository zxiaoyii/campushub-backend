import { isValidObjectId, type QueryFilter, type Types } from 'mongoose';
import { ResourceModel, type IResource } from '../models/Resource.model.ts';
import {
  RESOURCE_TYPES,
  type Resource,
  type ResourceInput,
  type ResourceType,
} from '../types/reservation.ts';

/** The persisted fields this layer reads back, independent of Mongoose's document wrappers. */
interface ResourceRecord extends IResource {
  _id: Types.ObjectId;
}

function toResource(record: ResourceRecord): Resource {
  return {
    id: record._id.toString(),
    name: record.name,
    type: record.type,
    location: record.location,
    isAvailable: record.isAvailable,
  };
}

function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

/**
 * An unrecognised type matches nothing rather than failing, which is what the
 * contract documents — so it never reaches the database.
 */
export async function listResources(type?: string): Promise<Resource[]> {
  if (type !== undefined && !isResourceType(type)) {
    return [];
  }

  const filter: QueryFilter<IResource> =
    type === undefined ? {} : { type: type };

  const documents = await ResourceModel.find(filter)
    .sort({ name: 1 })
    .lean<ResourceRecord[]>()
    .exec();

  return documents.map(toResource);
}

export async function findResourceById(
  resourceId: string,
): Promise<Resource | null> {
  if (!isValidObjectId(resourceId)) {
    return null;
  }
  const document = await ResourceModel.findById(resourceId)
    .lean<ResourceRecord | null>()
    .exec();
  return document === null ? null : toResource(document);
}

/** Replaces the whole catalogue. Used by the seed script, not by the API. */
export async function replaceResourceCatalogue(
  resources: readonly ResourceInput[],
): Promise<Resource[]> {
  await ResourceModel.deleteMany({}).exec();
  const created = await ResourceModel.insertMany(resources);
  return created.map((document): Resource => toResource(document));
}
