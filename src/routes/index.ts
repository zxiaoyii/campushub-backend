import { Router } from 'express';
import { healthRouter } from './health.routes.ts';

export const apiV1Router: Router = Router();

apiV1Router.use(healthRouter);
