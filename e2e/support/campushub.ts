/**
 * The page vocabulary the specs are written in.
 *
 * Every locator here is user-facing — a role, a label or visible text — so a
 * CSS module renaming a class, or a component changing its markup, does not
 * break the suite. The three panels are addressed as landmarks, which keeps a
 * button named "Cancel" or "Refresh" unambiguous no matter how many panels
 * grow one.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** A booking window, formatted the way a datetime-local input accepts it. */
export interface BookingWindow {
  readonly start: string;
  readonly end: string;
}

export function resourcesPanel(page: Page): Locator {
  return page.getByRole('region', { name: 'Resources' });
}

export function bookingPanel(page: Page): Locator {
  return page.getByRole('region', { name: 'Book a resource' });
}

export function bookingsPanel(page: Page): Locator {
  return page.getByRole('region', { name: 'My bookings' });
}

export function resourceCard(page: Page, name: string): Locator {
  return resourcesPanel(page).getByRole('button', { name: new RegExp(name) });
}

/** Opens the page as a given student. The id scopes "My bookings" to one test. */
export async function openAs(page: Page, studentId: string): Promise<void> {
  await page.goto('/');
  await signInAs(page, studentId);
}

export async function signInAs(page: Page, studentId: string): Promise<void> {
  await page.getByLabel('Student id').fill(studentId);
  await expect(bookingsPanel(page).getByText('Loading bookings…')).toBeHidden();
}

export async function filterByType(page: Page, type: string): Promise<void> {
  await resourcesPanel(page)
    .getByRole('button', { name: type, exact: true })
    .click();
}

/** Selects a resource and fills and submits the booking form for one window. */
export async function requestBooking(
  page: Page,
  window: BookingWindow,
): Promise<void> {
  const panel = bookingPanel(page);
  await panel.getByLabel('Start', { exact: true }).fill(window.start);
  await panel.getByLabel('End', { exact: true }).fill(window.end);
  await panel.getByRole('button', { name: 'Request booking' }).click();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `2026-12-01T10:00` — what a datetime-local input reads and writes. */
function toInputValue(moment: Date): string {
  return (
    `${String(moment.getFullYear())}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}` +
    `T${pad(moment.getHours())}:${pad(moment.getMinutes())}`
  );
}

/**
 * A one-hour slot of its own for every scenario, derived from a key rather
 * than from the clock. One database serves the whole run, across browsers, so
 * two scenarios sharing an hour on one resource would conflict by accident and
 * the double-booking test would pass for the wrong reason. Callers put the
 * browser project in the key, so the same scenario books a different hour in
 * each of them.
 */
export function reservationWindow(key: string): BookingWindow {
  let hash = 0;
  for (const character of key) {
    hash = (hash * 31 + character.charCodeAt(0)) % 9973;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);
  start.setHours(start.getHours() + hash);

  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return { start: toInputValue(start), end: toInputValue(end) };
}
