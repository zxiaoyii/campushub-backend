import { Router } from 'express';
import { handleHealthCheck } from '../controllers/health.controller.ts';

export const healthRouter: Router = Router();

healthRouter.get('/health', handleHealthCheck);
