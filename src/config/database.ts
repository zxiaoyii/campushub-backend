import mongoose from 'mongoose';
import { appConfig } from './env.ts';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(appConfig.mongoUri, {
    serverSelectionTimeoutMS: appConfig.mongoTimeoutMs,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
