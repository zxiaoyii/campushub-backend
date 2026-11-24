/**
 * The scenarios in `e2e/scenarios/reservation.feature`, executed against the
 * running stack: the React client on its dev server, the Express API, and an
 * ephemeral MongoDB seeded with the resource catalogue.
 *
 * Each scenario books its own hour as its own student, so the suite is
 * order-independent and the only conflict it sees is the one it creates.
 */
import { expect, test } from '@playwright/test';
import {
  bookingPanel,
  bookingsPanel,
  filterByType,
  openAs,
  requestBooking,
  reservationWindow,
  resourceCard,
  signInAs,
} from './support/campushub.ts';

test.describe('Campus resource reservation engine', () => {
  test('a student reserves an available study room', async ({
    page,
  }, testInfo) => {
    const slot = reservationWindow(`${testInfo.project.name}:study-room-302`);
    await openAs(page, `e2e-booker-${testInfo.project.name}`);

    await filterByType(page, 'ROOM');
    await resourceCard(page, 'Study Room 302').click();
    await expect(bookingPanel(page)).toContainText('Booking Study Room 302');

    await requestBooking(page, slot);

    await expect(bookingPanel(page).getByRole('status')).toHaveText(
      /^Booked\. Reservation [a-f0-9]{24} is PENDING\.$/,
    );
    await expect(bookingsPanel(page).getByRole('listitem')).toHaveCount(1);
    await expect(bookingsPanel(page).getByRole('listitem')).toContainText(
      'PENDING',
    );
  });

  test('a double booking is reported as a conflict', async ({
    page,
  }, testInfo) => {
    const slot = reservationWindow(`${testInfo.project.name}:3d-printer-a`);
    await openAs(page, `e2e-first-${testInfo.project.name}`);

    await filterByType(page, 'EQUIPMENT');
    await resourceCard(page, '3D Printer A').click();
    await requestBooking(page, slot);
    await expect(bookingsPanel(page).getByRole('listitem')).toHaveCount(1);

    // The second student wants the same printer for the same hour.
    await signInAs(page, `e2e-second-${testInfo.project.name}`);
    await requestBooking(page, slot);

    await expect(bookingPanel(page).getByRole('alert')).toContainText(
      'DOUBLE_BOOKING',
    );
    await expect(bookingPanel(page).getByRole('status')).toBeHidden();
    await expect(bookingsPanel(page)).toContainText('No active bookings.');
  });

  test('cancelling a booking releases the slot', async ({ page }, testInfo) => {
    const slot = reservationWindow(`${testInfo.project.name}:study-room-415`);
    await openAs(page, `e2e-canceller-${testInfo.project.name}`);

    await filterByType(page, 'ROOM');
    await resourceCard(page, 'Study Room 415').click();
    await requestBooking(page, slot);
    await expect(bookingsPanel(page).getByRole('listitem')).toHaveCount(1);

    await bookingsPanel(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(bookingsPanel(page)).toContainText('No active bookings.');

    // The freed hour is bookable again, by someone else.
    await signInAs(page, `e2e-successor-${testInfo.project.name}`);
    await requestBooking(page, slot);

    await expect(bookingPanel(page).getByRole('status')).toContainText(
      'is PENDING.',
    );
    await expect(bookingsPanel(page).getByRole('listitem')).toHaveCount(1);
  });

  test('a resource that is out of service cannot be selected', async ({
    page,
  }, testInfo) => {
    await openAs(page, `e2e-browser-${testInfo.project.name}`);

    await filterByType(page, 'LAB');

    const card = resourceCard(page, 'Robotics Lab');
    await expect(card).toContainText('Unavailable');
    await expect(card).toBeDisabled();
    await expect(bookingPanel(page)).toContainText('No resource selected.');
  });
});
