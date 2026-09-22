export type HealthState = 'ok' | 'degraded';

export interface HealthStatus {
  readonly status: HealthState;
  readonly service: string;
  readonly environment: string;
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}
