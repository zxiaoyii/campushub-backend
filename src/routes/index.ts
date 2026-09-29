import { Router } from 'express';
import { healthRouter } from './health.routes.ts';
import { reservationRouter } from './reservation.routes.ts';
import { resourceRouter } from './resource.routes.ts';

export const apiV1Router: Router = Router();

apiV1Router.use(healthRouter);
apiV1Router.use(resourceRouter);
apiV1Router.use(reservationRouter);
