import process from 'node:process';
import { connectDatabase, disconnectDatabase } from './config/database.ts';
import { replaceResourceCatalogue } from './services/resource.service.ts';
import type { ResourceInput } from './types/reservation.ts';

const CATALOGUE: readonly ResourceInput[] = [
  {
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Snell Library, Floor 3',
    isAvailable: true,
  },
  {
    name: 'Study Room 415',
    type: 'ROOM',
    location: 'Snell Library, Floor 4',
    isAvailable: true,
  },
  {
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Makerspace, Curry Student Center',
    isAvailable: true,
  },
  {
    name: 'Robotics Lab',
    type: 'LAB',
    location: 'Richards Hall 210',
    isAvailable: false,
  },
];

await connectDatabase();

try {
  const resources = await replaceResourceCatalogue(CATALOGUE);
  console.log(`[seed] inserted ${String(resources.length)} resources`);
  for (const resource of resources) {
    console.log(
      `  ${resource.id}  ${resource.type.padEnd(9)} ${resource.name}`,
    );
  }
} catch (error: unknown) {
  console.error('[seed] failed', error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
