import { Router } from 'express';
import {
  handleCancelReservation,
  handleConfirmReservation,
  handleCreateReservation,
  handleListUserReservations,
} from '../controllers/reservation.controller.ts';

/**
 * Routes for the reservation endpoints in docs/openapi.yaml. Mounted under
 * /api/v1, so the paths below complete the contract's operation paths.
 *
 * /reservations/user/:userId is declared before /reservations/:reservationId/*
 * because Express matches in registration order and the two patterns overlap.
 */
export const reservationRouter: Router = Router();

// POST /api/v1/reservations — createReservation
reservationRouter.post('/reservations', handleCreateReservation);

// GET /api/v1/reservations/user/{userId} — listUserReservations
reservationRouter.get('/reservations/user/:userId', handleListUserReservations);

// PATCH /api/v1/reservations/{reservationId}/cancel — cancelReservation
reservationRouter.patch(
  '/reservations/:reservationId/cancel',
  handleCancelReservation,
);

// PATCH /api/v1/reservations/{reservationId}/confirm — confirmReservation
reservationRouter.patch(
  '/reservations/:reservationId/confirm',
  handleConfirmReservation,
);
