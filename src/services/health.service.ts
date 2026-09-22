import process from 'node:process';
import { appConfig } from '../config/env.ts';
import type { HealthStatus } from '../types/health.ts';

const SERVICE_NAME = 'campushub-backend';

/**
 * Builds the service health report.
 *
 * Synchronous on purpose: there is nothing to await yet. When a MongoDB
 * connectivity probe is added, this becomes `Promise<HealthStatus>` and the
 * controller awaits it — declaring it async now would be a lie the linter
 * rightly rejects.
 */
export function getHealthStatus(): HealthStatus {
  return {
    status: 'ok',
    service: SERVICE_NAME,
    environment: appConfig.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
