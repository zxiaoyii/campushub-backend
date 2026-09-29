import { Router } from 'express';
import {
  handleCreateReservation,
  handleListUserReservations,
} from '../controllers/reservation.controller.ts';

/**
 * Routes for the reservation endpoints in docs/openapi.yaml. Mounted under
 * /api/v1, so the paths below complete the contract's operation paths.
 */
export const reservationRouter: Router = Router();

// POST /api/v1/reservations — createReservation
reservationRouter.post('/reservations', handleCreateReservation);

// GET /api/v1/reservations/user/{userId} — listUserReservations
reservationRouter.get('/reservations/user/:userId', handleListUserReservations);
