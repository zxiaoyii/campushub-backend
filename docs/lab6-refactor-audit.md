# Lab 6 — Refactoring Audit

What the repository looked like after Labs 1–5, what was wrong with it, and
what the refactoring pass changed. Written before the refactor and updated with
the outcome.

## Scope

Backend `src/` (Express, 18 files) and frontend `client/src/` (React, 9 files),
plus the agent context files at the root.

---

## Part 1 — Context and ignore

### Finding C1: no ignore file for agents

Nothing stopped an agent from reading `node_modules/`, `dist/`,
`client/dist/`, `package-lock.json` or the source maps in the built bundle.
`package-lock.json` alone is about 5,500 lines. A single "where is the
reservation overlap check" query could pull in generated output that is never
the right file to edit.

**Change.** Added `.cursorignore` at the root listing dependencies, build
output, lockfiles, coverage, logs, source maps and `.env`. Claude Code does not
read `.cursorignore`, so `.claude/settings.json` denies the same paths through
`permissions.deny`. AGENTS.md §7 now states that a new generated directory has
to be added to both.

### Finding C2: stale rules in AGENTS.md

Three rules no longer described the code:

| Rule                                                         | Why it was stale                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `ts-node` listed as approved tooling                         | Nothing used it; the scripts run through Node's native TypeScript support. It was also still in `devDependencies`. |
| `"start": "node dist/server.js"`                             | Correct until `rootDir` changed; the build now emits `dist/src/`.                                                  |
| "Every `await` on a fallible call is covered by `try/catch`" | This rule is what produced Finding B1. It instructed agents to write the duplication the lab asks to remove.       |

**Change.** All three corrected, `ts-node` uninstalled, and §7 added: a rule
that no longer describes the code is worse than no rule, because it will be
followed.

---

## Part 2 — Bloat and redundancy

### Finding B1: six identical try/catch blocks in controllers

Every controller wrapped its body in the same five lines:

```ts
try {
  // one or two real statements
} catch (error: unknown) {
  next(error);
}
```

Six copies across three files, forwarding to a centralized error middleware
that already existed. Express 5 forwards both a synchronous throw and a
rejected promise from a handler to the error middleware on its own, so none of
them did anything.

**Change.** Removed all six, along with the now-unused `next` parameter.
`handleHealthCheck` went from 16 lines to 10, `reservation.controller.ts` from
131 to 109. The error middleware moved to the path the lab names,
`src/middleware/errorHandler.ts`, and its comment records why controllers do
not catch.

### Finding B2: contract types declared twice

`src/types/reservation.ts` and `client/src/types/api.ts` both declared
`Resource`, `Reservation`, `ResourceType` and `ReservationStatus`, and
`src/types/error.ts` and `client/src/types/api.ts` both declared
`ErrorResponse`. The pair had already drifted: the backend called the request
body `ReservationCreate`, matching the contract, while the client called the
same shape `CreateReservationDTO`.

**Change.** One declaration layer at `shared/contract.ts`, at the repository
root so neither side owns it. The backend imports it as
`../../shared/contract.ts`; the client imports it as `@contract`, an alias
defined in both `vite.config.ts` and `tsconfig.app.json`. The three duplicate
type files are deleted. `ListResourcesQuery`, which nothing imported, is gone
with them.

### Finding B3: the same fetch-and-state block in three components

`ResourceList`, `UserReservations` and `BookingForm` each carried their own
`isLoading` / `error` state, their own `try/catch/finally`, and their own
`caught instanceof ApiError ? caught.message : '...'` ternary. Three copies of
one pattern, and `BookingForm` was 147 lines with the submit logic sitting in
the middle of the JSX.

**Change.** `describeApiError` in `api/campushubApi.ts` is now the only place
that reads an `ApiError`. The state moved into two hooks:

- `hooks/useReservations.ts` — `useUserReservations(userId, refreshToken)` owns
  the list, the cancel and both their failure states; `useCreateReservation()`
  owns the POST and its outcome.
- `hooks/useResources.ts` — `useResources()` owns the catalogue and the type
  filter.

The components now render. `UserReservations` went from 128 lines to 79,
`ResourceList` from 99 to 72, `BookingForm` from 147 to 123 (what remains is
the form markup and the client-side validation, which is presentation logic).

One behaviour changed on purpose: a 409 used to be reported with wording
hardcoded in `BookingForm`. `describeApiError` now shows the backend's own
message plus the code — `Resource is already reserved for this time slot.
(DOUBLE_BOOKING)` — so `RESOURCE_UNAVAILABLE` reads correctly too instead of
claiming a double booking.

### Not found

- No duplicated utility functions. `toIso` and `formatSlot` each exist once
  and are used once.
- No repeated validation helpers in the backend; `requireString` and
  `requireIsoDateTime` are already shared inside the one controller that needs
  them.
- No component over 150 lines after the pass; the largest is `BookingForm` at 123.

---

## Totals

|                                 | Before    | After     |
| ------------------------------- | --------- | --------- |
| Controllers (3 files)           | 199 lines | 166 lines |
| Components (4 files)            | 393 lines | 293 lines |
| Declarations of `Resource`      | 2         | 1         |
| Declarations of `ErrorResponse` | 2         | 1         |
| `try/catch` in controllers      | 6         | 0         |
| Copies of the ApiError ternary  | 4         | 1         |

Lines moved into `hooks/` (188) and `shared/contract.ts` (72) are not a
reduction in total size. The point was to make each of those blocks exist once.

## Verification

No functional regression. Checked after the pass:

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`
- `cd client && npm run build && npm run lint`
- `npx @redocly/cli lint docs/openapi.yaml`
- The server started and every endpoint was called: health 200, resources 200,
  create 201, overlapping create 409 `DOUBLE_BOOKING`, unavailable resource 409
  `RESOURCE_UNAVAILABLE`, bad body 400, unknown id 404, list 200, cancel 200,
  cancel again 409.
