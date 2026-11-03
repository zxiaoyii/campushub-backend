import type { Request, Response } from 'express';
import { getHealthStatus } from '../services/health.service.ts';
import type { HealthStatus } from '../types/health.ts';

export function handleHealthCheck(
  _req: Request,
  res: Response<HealthStatus>,
): void {
  res.status(200).json(getHealthStatus());
}
