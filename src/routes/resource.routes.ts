import { Router } from 'express';
import { handleListResources } from '../controllers/resource.controller.ts';

/**
 * Routes for the resource endpoints in docs/openapi.yaml. Mounted under
 * /api/v1.
 */
export const resourceRouter: Router = Router();

// GET /api/v1/resources — listResources
resourceRouter.get('/resources', handleListResources);
