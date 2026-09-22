import type { NextFunction, Request, Response } from 'express';
import { getHealthStatus } from '../services/health.service.ts';
import type { HealthStatus } from '../types/health.ts';

export function handleHealthCheck(
  _req: Request,
  res: Response<HealthStatus>,
  next: NextFunction,
): void {
  try {
    const status: HealthStatus = getHealthStatus();
    res.status(200).json(status);
  } catch (error: unknown) {
    next(error);
  }
}
