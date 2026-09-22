import process from 'node:process';
import { appConfig } from '../config/env.ts';
import type { HealthStatus } from '../types/health.ts';

const SERVICE_NAME = 'campushub-backend';

/**
 * Builds the service health report. Async because later labs will extend this
 * with a MongoDB connectivity probe; keeping the signature stable now avoids
 * a breaking change to the controller.
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  return {
    status: 'ok',
    service: SERVICE_NAME,
    environment: appConfig.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
