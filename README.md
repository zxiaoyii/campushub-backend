# CampusHub Backend

Multi-tenant campus resource management API — CS 5500 semester project.

TypeScript · Node.js · Express · MongoDB (Mongoose) · React

## Requirements

- Node.js >= 24.21.0
- npm >= 11.19.1
- MongoDB reachable at `MONGODB_URI` (defaults to
  `mongodb://127.0.0.1:27017/campushub`)

The quickest local database, if you have Docker:

```bash
docker run -d --name campushub-mongo -p 27017:27017 \
  -v campushub-mongo-data:/data/db mongo:8
```

## Setup

```bash
npm ci
cp .env-example .env   # optional — the defaults work for a local MongoDB
npm run seed           # loads the resource catalogue; required before booking
npm run dev
```

The server listens on <http://localhost:3000> and mounts every route under
`/api/v1`. It will not start if the database is unreachable.

## Scripts

| Script                  | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | Start with reload (Node runs the TS sources)   |
| `npm run seed`          | Reset the resource catalogue in MongoDB        |
| `npm run build`         | Compile `src/` to `dist/`                      |
| `npm start`             | Run the compiled build                         |
| `npm run typecheck`     | `tsc --noEmit`                                 |
| `npm run lint`          | ESLint, including the architectural boundaries |
| `npm run format:check`  | Prettier check (`npm run format` to write)     |
| `npm test`              | Jest suites against an in-memory MongoDB       |
| `npm run test:coverage` | The same suites plus the coverage report       |

## Endpoints

`docs/openapi.yaml` is the authoritative contract; the table below summarizes
it.

| Method | Path                                | Success | Errors        |
| ------ | ----------------------------------- | ------- | ------------- |
| GET    | `/api/v1/health`                    | 200     | —             |
| GET    | `/api/v1/resources`                 | 200     | 400           |
| POST   | `/api/v1/reservations`              | 201     | 400, 404, 409 |
| GET    | `/api/v1/reservations/user/{id}`    | 200     | 400           |
| PATCH  | `/api/v1/reservations/{id}/confirm` | 200     | 400, 404, 409 |
| PATCH  | `/api/v1/reservations/{id}/cancel`  | 200     | 400, 404, 409 |

`GET /resources` accepts `?type=` and `?isAvailable=`. `type` is a non-empty
string rather than an enum: an unrecognised type matches nothing (`200 []`),
while an empty value is a malformed request (`400`). `isAvailable` accepts
only `true` or `false`.

Cancelling a reservation frees its slot straight away, because the overlap
check only counts PENDING and CONFIRMED rows. `endTime` must be after
`startTime`; a reversed or zero-length window is a `400`.

Every error responds with the contract's flat shape:

```json
{
  "code": "DOUBLE_BOOKING",
  "message": "Resource is already reserved for this time slot."
}
```

### Try it

Resource ids are MongoDB ObjectIds assigned by `npm run seed`, so take one from
the list rather than hardcoding it.

```bash
curl -i http://localhost:3000/api/v1/health
curl -i "http://localhost:3000/api/v1/resources"
curl -i "http://localhost:3000/api/v1/resources?type=ROOM"

RID=$(curl -s "http://localhost:3000/api/v1/resources?type=ROOM" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")

# Create a reservation -> 201
curl -i -X POST http://localhost:3000/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d "{\"resourceId\":\"$RID\",\"userId\":\"user-456\",\"startTime\":\"2026-10-01T10:00:00Z\",\"endTime\":\"2026-10-01T11:00:00Z\"}"

# Same resource, overlapping slot -> 409 DOUBLE_BOOKING
curl -i -X POST http://localhost:3000/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d "{\"resourceId\":\"$RID\",\"userId\":\"user-789\",\"startTime\":\"2026-10-01T10:30:00Z\",\"endTime\":\"2026-10-01T11:30:00Z\"}"

# That user's active reservations
curl -i http://localhost:3000/api/v1/reservations/user/user-456
```

The seed loads four resources: two ROOM, one EQUIPMENT, and one LAB marked
unavailable (booking it returns 409 RESOURCE_UNAVAILABLE).

## Tests

```bash
npm test
npm run test:coverage
```

Jest with ts-jest, Supertest for the endpoints, and `mongodb-memory-server`
for persistence. No Docker and no `.env` are needed: `src/test/setup.ts`
starts its own MongoDB in memory and connects Mongoose to it, so a test run
cannot reach the development database. The first run downloads the MongoDB
binary and takes longer than the rest.

```
src/services/__tests__/   Unit tests per service
src/routes/__tests__/     Supertest integration tests per router
src/test/                 In-memory database setup and fixtures
```

Coverage of `src/services/` and `src/controllers/` is held at 80% of
statements and branches by `jest.config.ts`, so a drop fails the run rather
than a review. `npm run test:coverage` reports:

```
File                        | % Stmts | % Branch | % Funcs | % Lines
----------------------------|---------|----------|---------|--------
All files                   |     100 |     100  |     100 |     100
 controllers                |     100 |     100  |     100 |     100
  health.controller.ts      |     100 |     100  |     100 |     100
  reservation.controller.ts |     100 |     100  |     100 |     100
  resource.controller.ts    |     100 |     100  |     100 |     100
 services                   |     100 |     100  |     100 |     100
  health.service.ts         |     100 |     100  |     100 |     100
  reservation.service.ts    |     100 |     100  |     100 |     100
  resource.service.ts       |     100 |     100  |     100 |     100

Test Suites: 4 passed, 4 total
Tests:       81 passed, 81 total
```

The report itself is generated into `coverage/`, which is not committed.

Two defects surfaced while writing them, both fixed:

- Three concurrent requests for the same window were all accepted. The overlap
  check is a read followed by a write, so a unique partial index on
  `{ resourceId, startTime, endTime }` for active statuses now rejects the
  duplicates, and the service reports the duplicate-key error as 409
  `DOUBLE_BOOKING`. Partial overlaps that are not an exact match are still a
  check-then-write and would need a transaction to close.
- A syntactically broken request body was reported as `500`. The error
  middleware now maps a 4xx from `express.json()` to a contract-shaped `400`.

## Validating the contract

```bash
npx @redocly/cli lint docs/openapi.yaml
```

The one expected warning is the `localhost` server URL, which the course
requires.

## Frontend

A React + TypeScript client lives in `client/`. Start the backend first, then:

```bash
cd client
npm ci
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` to port 3000, so no CORS setup is needed. The
page lists resources with a type filter, books a selected resource, and shows
the signed-in student's bookings with a cancel action. A double booking comes
back as 409 and is shown as an explicit conflict message rather than a generic
failure.

## Layout

```
docs/openapi.yaml   Authoritative API contract
shared/contract.ts  Types crossing the HTTP boundary, imported by both sides
src/
├── config/         Environment loading and validation
├── routes/         Path-to-controller mapping only
├── controllers/    Request/response handling and status codes
├── services/       Business logic, HTTP-agnostic
├── models/         Mongoose schemas and document interfaces
├── middleware/     Centralized error handling
├── types/          Server-only types (domain errors, health)
├── app.ts          Express assembly; bootstrapApp opens the DB connection
├── server.ts       Process bootstrap (listen, signals)
└── seed.ts         Resource catalogue loader

client/src/
├── api/            Typed calls to the backend
├── hooks/          Fetching and state (useReservations, useResources)
├── components/     ResourceList, BookingForm, UserReservations
└── App.tsx         Composition and shared state
```

`shared/contract.ts` is the only declaration of `Resource`, `Reservation` and
`ErrorResponse` in the repository. The backend imports it by relative path;
the client imports it as `@contract`, aliased in `vite.config.ts` and
`client/tsconfig.app.json`. Renaming a field there breaks both sides at once,
which is the point.

Controllers contain no `try/catch`. Express 5 forwards a throw or a rejected
promise to `src/middleware/errorHandler.ts`, which is the only place a failure
becomes an HTTP response.

Dependencies flow one way: `routes → controllers → services → models`. ESLint
enforces this, so a cross-layer import fails `npm run lint` rather than
slipping through review.

## Agent context

`AGENTS.md` is the governing context file for AI coding agents working in this
repository; `CLAUDE.md` imports it so Claude Code reads the same rules. It
constrains the stack, the architectural boundaries, typing and error handling,
and makes `docs/openapi.yaml` authoritative over the implementation.

`.cursorignore` lists the paths an agent must never read — dependencies, build
output, lockfiles, coverage, logs, source maps and `.env`. Claude Code does not
read that file, so `.claude/settings.json` denies the same paths. Both have to
be updated when a new generated directory appears.

`docs/lab6-refactor-audit.md` records the refactoring pass over Labs 1–5: what
was duplicated, what was removed, and how it was verified.
