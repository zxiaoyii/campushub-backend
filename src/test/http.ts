import type { Response } from 'supertest';

/**
 * supertest declares `response.body` as `any`, which AGENTS.md §4 forbids
 * dereferencing. Every body the API returns is a contract shape, so the
 * suites read it through this one narrowing point instead of spreading
 * unchecked member access across the assertions.
 */
export function jsonBody<T>(response: Response): T {
  return response.body as T;
}
