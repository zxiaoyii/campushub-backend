# CampusHub Backend

Multi-tenant campus resource management API — CS 5500 semester project.

TypeScript · Node.js · Express · MongoDB (Mongoose, arriving in a later lab)

## Requirements

- Node.js >= 24.21.0
- npm >= 11.19.1

No database is required to run the project today: the reservation engine uses
in-memory stores that stand in for Mongoose models.

## Setup

```bash
npm ci
cp .env-example .env   # optional — sensible defaults apply without it
npm run dev
```

The server listens on <http://localhost:3000> and mounts every route under
`/api/v1`.

## Scripts

| Script                 | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start with reload (Node runs the TS sources)   |
| `npm run build`        | Compile `src/` to `dist/`                      |
| `npm start`            | Run the compiled build                         |
| `npm run typecheck`    | `tsc --noEmit`                                 |
| `npm run lint`         | ESLint, including the architectural boundaries |
| `npm run format:check` | Prettier check (`npm run format` to write)     |

## Endpoints

`docs/openapi.yaml` is the authoritative contract; the table below summarizes
it.

| Method | Path                             | Success | Errors        |
| ------ | -------------------------------- | ------- | ------------- |
| GET    | `/api/v1/health`                 | 200     | —             |
| GET    | `/api/v1/resources`              | 200     | 400           |
| POST   | `/api/v1/reservations`           | 201     | 400, 404, 409 |
| GET    | `/api/v1/reservations/user/{id}` | 200     | 400           |

`GET /resources` accepts an optional `?type=` filter. It is a non-empty string
rather than an enum: an unrecognised type matches nothing (`200 []`), while an
empty value is a malformed request (`400`).

Every error responds with the contract's flat shape:

```json
{
  "code": "DOUBLE_BOOKING",
  "message": "Resource is already reserved for this time slot."
}
```

### Try it

```bash
# List resources, then filter by type
curl -i http://localhost:3000/api/v1/health
curl -i "http://localhost:3000/api/v1/resources"
curl -i "http://localhost:3000/api/v1/resources?type=ROOM"

# Create a reservation -> 201
curl -i -X POST http://localhost:3000/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d '{"resourceId":"res-101","userId":"user-456","startTime":"2026-10-01T10:00:00Z","endTime":"2026-10-01T11:00:00Z"}'

# Same resource, overlapping slot -> 409 DOUBLE_BOOKING
curl -i -X POST http://localhost:3000/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d '{"resourceId":"res-101","userId":"user-789","startTime":"2026-10-01T10:30:00Z","endTime":"2026-10-01T11:30:00Z"}'

# That user's active reservations
curl -i http://localhost:3000/api/v1/reservations/user/user-456
```

Seeded resource ids: `res-101`, `res-102` (ROOM), `res-201` (EQUIPMENT),
`res-301` (LAB, unavailable).

## Validating the contract

```bash
npx @redocly/cli lint docs/openapi.yaml
```

The one expected warning is the `localhost` server URL, which the course
requires.

## Layout

```
docs/openapi.yaml   Authoritative API contract
src/
├── config/         Environment loading and validation
├── routes/         Path-to-controller mapping only
├── controllers/    Request/response handling and status codes
├── services/       Business logic, HTTP-agnostic
├── models/         Mongoose schemas (later labs)
├── middleware/     Centralized error handling
├── types/          Shared interfaces, mirroring the contract
├── app.ts          Express assembly (exported, does not listen)
└── server.ts       Process bootstrap
```

Dependencies flow one way: `routes → controllers → services → models`. ESLint
enforces this, so a cross-layer import fails `npm run lint` rather than
slipping through review.

## Agent context

`AGENTS.md` is the governing context file for AI coding agents working in this
repository; `CLAUDE.md` imports it so Claude Code reads the same rules. It
constrains the stack, the architectural boundaries, typing and error handling,
and makes `docs/openapi.yaml` authoritative over the implementation.
