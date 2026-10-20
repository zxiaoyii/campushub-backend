# Lab 4 — Steering Log

Failures hit while implementing the reservation engine, and how each one was
caught and fixed. Everything below happened during this lab; nothing is
reconstructed after the fact.

How I worked: I ran the lab as a conversation with the agent rather than by
typing one prompt per file. The agent wrote the code, and my part was setting
the direction, checking the output, and deciding what to do when something
came back wrong. The "Steering" entries below are the corrections that were
actually issued in that session, written out as the instruction that redirected
the work. Detection is listed separately from the correction, because in two of
the three cases the tooling found the problem before I did.

---

### Incident 1: Seed script left reservations pointing at deleted resources

- **Initial Agent Output:** `npm run seed` was written in Lab 3 to reset the
  resource catalogue. It calls `replaceResourceCatalogue()`, which runs
  `deleteMany({})` on resources and inserts the four seed rows again. It never
  touched the reservations collection. After reseeding during this lab,
  `GET /reservations/user/user-456` returned reservations whose `resourceId`
  pointed at resources that no longer existed. A direct query confirmed 3 of
  the 5 reservations in the database were orphaned.

- **Detected by:** Querying MongoDB directly after a reseed. No tool reported
  anything; every endpoint still returned 200.

- **Root Cause:** The seed script was written to answer the request it was
  given — "load the resource catalogue" — and nothing more. Reseeding assigns
  new ObjectIds to every resource, so any reservation created before a reseed
  is left dangling. The agent had no reason to consider the second collection
  because the prompt only mentioned resources, and `tsc` and ESLint cannot see
  a referential problem that lives in the data.

- **Steering (correction issued):** "npm run seed deletes all resources and inserts them
  with new ObjectIds, but leaves the reservations collection untouched, so old
  reservations point at resources that no longer exist. Fix the seed so it
  clears reservations too. Keep the database access in the service layer —
  seed.ts must not call the model directly."

- **Resolution:** Added `clearReservations()` to `reservation.service.ts` and
  called it from `seed.ts` before the catalogue is replaced. Re-ran the seed
  and queried MongoDB directly: 0 reservations, 0 orphans. Re-ran the full set
  of endpoint tests afterwards to confirm nothing else depended on the stale
  rows.

---

### Incident 2: Changing a service signature silently broke its caller

- **Initial Agent Output:** Adding the `isAvailable` filter meant
  `listResources` needed a second argument. The signature was changed from
  `listResources(type?: string)` to `listResources(criteria: ResourceFilter)`,
  and the service file compiled on its own. The controller still called it
  with a bare string. `tsc` failed with `TS2345: Argument of type 'string |
undefined' is not assignable to parameter of type 'ResourceFilter'`.

- **Detected by:** `npm run typecheck`, immediately after the edit.

- **Root Cause:** This is the multi-file problem the lab describes. The change
  was made in one file while the caller sat in another, and the edit was
  treated as finished before the project was type-checked as a whole.

- **Steering (correction issued):** "The service signature changed, so update
  resource.controller.ts to build a ResourceFilter object. Note that
  `exactOptionalPropertyTypes` is on, so an absent filter has to be omitted
  from the object, not set to undefined."

- **Resolution:** The controller now parses both query parameters and
  assembles the filter with conditional spreads, so an absent parameter is
  left out of the object entirely. `npm run typecheck` and `npm run lint` both
  pass. Verified by request: `?isAvailable=true` returns 3 resources,
  `?isAvailable=false` returns 1, `?type=ROOM&isAvailable=true` returns 2, and
  `?isAvailable=yes` returns 400.

---

### Incident 3: New route pattern collided with an existing one

- **Initial Agent Output:** `PATCH /reservations/{reservationId}/cancel` was
  added to the contract next to the existing
  `GET /reservations/user/{userId}`. Both are three segments long and both
  have a variable in a position the other fills with a literal, so
  `/reservations/user/cancel` would match either. `npx @redocly/cli lint`
  raised `no-ambiguous-paths`, which had not appeared on this contract before.

- **Detected by:** `npx @redocly/cli lint docs/openapi.yaml`, run as part of
  the contract-first step before any code was written.

- **Root Cause:** The new path was designed by looking at the endpoint being
  added rather than at the set of paths as a whole. Express resolves this kind
  of overlap by registration order, so the problem would not have produced an
  error — the wrong handler would simply run for certain inputs.

- **Steering (correction issued):** "Redocly reports no-ambiguous-paths between
  /reservations/user/{userId} and /reservations/{reservationId}/cancel. Keep
  both paths, since the contract for the user endpoint is fixed from Lab 2, but
  register the literal route before the parameterised one in Express and say
  why in a comment. Then prove the user endpoint still resolves correctly."

- **Resolution:** `/reservations/user/:userId` is registered before the two
  `/reservations/:reservationId/*` routes, with a comment stating the reason.
  Tested after the change: `GET /api/v1/reservations/user/user-456` still
  returns 200 with that user's reservations rather than being captured by the
  cancel route. The lint warning is accepted and left in place, since changing
  the user path would break the Lab 2 contract.

---

## Notes

The three incidents failed in different ways, and only one of them would have
been caught by the tooling alone:

- Incident 2 was a compiler error. It could not be ignored.
- Incident 3 was a linter warning on the contract. It would have compiled,
  run, and only misbehaved for a request that happened to hit the overlap.
- Incident 1 produced no error of any kind. Types were correct, lint was
  clean, every endpoint returned 200, and the data was still wrong. It was
  only found by querying the database directly after a reseed.

The further a failure sits from the compiler, the more it depends on someone
deciding to go and look.
