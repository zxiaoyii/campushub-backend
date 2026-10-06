import { Schema, model, type Model } from 'mongoose';
import { RESOURCE_TYPES, type ResourceType } from '../types/reservation.ts';

export interface IResource {
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

const resourceSchema = new Schema<IResource>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: [...RESOURCE_TYPES] },
    location: { type: String, required: true, trim: true },
    isAvailable: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false },
);

resourceSchema.index({ type: 1 });

export const ResourceModel: Model<IResource> = model<IResource>(
  'Resource',
  resourceSchema,
);
