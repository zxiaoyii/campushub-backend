# AGENTS.md — CampusHub Backend

Governing context file for any AI coding agent working in this repository.
These are **constraints, not suggestions**. If a requested change cannot be made
without violating a rule below, stop and say so instead of working around it.

---

## 1. Project

CampusHub is a **multi-tenant** campus resource management API. Multiple
institutions share one deployment; every tenant's data must stay isolated.

- Every domain document carries a `tenantId`.
- Every query that touches tenant-owned data **must** be scoped by `tenantId`.
  A query without a tenant filter is a data-leak bug, not a style issue.
- `tenantId` is resolved from the authenticated request context — never from a
  client-supplied request body field.
- Not implemented yet: no endpoint authenticates, so the current models carry
  no `tenantId`. This rule applies from the lab that introduces auth onward,
  and is recorded here so the gap stays a decision rather than an oversight.

---

## 2. Tech Stack & Libraries

### Authorized

The packages below are **pre-approved**: install them when a task genuinely
needs them. Anything not in this table requires approval first.

| Purpose  | Package                                                                                 |
| -------- | --------------------------------------------------------------------------------------- |
| Language | TypeScript (strict mode)                                                                |
| Runtime  | Node.js >= 24.21.0                                                                      |
| HTTP     | `express`                                                                               |
| Database | `mongoose` (MongoDB)                                                                    |
| Config   | `dotenv`                                                                                |
| Types    | `@types/node`, `@types/express`                                                         |
| Tooling  | `typescript` (6.x), `eslint`, `typescript-eslint`, `eslint-config-prettier`, `prettier` |

### Forbidden

- **No `.js` / `.jsx` / `.mjs` / `.cjs` files under `src/`.** All source is
  `.ts`. Compiled JavaScript belongs in `dist/` and is never committed or
  hand-edited. (Root-level tooling config such as `eslint.config.mjs` is the
  only exception, and only when the tool cannot consume TypeScript.)
- **No new dependency without explicit approval** — runtime _or_ dev. Do not
  add a package to `package.json` on your own initiative. Propose it, state
  what it replaces, and wait for an answer. This includes "obvious" ones
  (lodash, axios, moment, nodemon, zod, jest).
- **No vendoring around the approval rule.** Copying a library's source into
  the repo, inlining it, or fetching it at runtime counts as adding a
  dependency and is equally forbidden.
- No alternative frameworks or ORMs (Nest, Fastify, Koa, Prisma, TypeORM,
  raw `mongodb` driver).
- No `require()` in source files — use ES import syntax.

### Runtime notes

**TypeScript is pinned to 6.x on purpose.** `typescript-eslint` declares a peer
range of `>=4.8.4 <6.1.0`, so TypeScript 7 makes the lint tooling uninstallable.
Enforced rules are worth more than the newest compiler; do not bump TypeScript
past 6.x until `typescript-eslint` supports it.

Scripts run sources through Node's native TypeScript support. `node --watch`
gives reload without a loader flag or an extra dependency, so no TypeScript
runner is installed:

```jsonc
"dev":   "node --watch src/server.ts",
"build": "tsc",
"start": "node dist/src/server.js"
```

The project is **ESM** (`"type": "module"`). Consequences, both mandatory:

- Relative imports carry an explicit `.ts` extension (`./config/env.ts`).
  Node needs it to resolve the file; `tsc` rewrites it to `.js` on build via
  `rewriteRelativeImportExtensions`. Extensionless relative imports do not
  compile.
- Type-only imports use `import type { ... }`.

Node **strips** types, it does not transform them, so TypeScript syntax that
compiles to runtime code is unusable even though `tsc` accepts it. No
constructor parameter properties (`constructor(public readonly x: string)`), no
`enum`, no `namespace`, no decorators. Declare and assign fields explicitly,
and use `as const` unions in place of enums. A violation only surfaces at
runtime as `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, so type-checking alone will not
catch it — run the server.

---

## 3. Architectural Boundaries

Strict 3-tier separation. The dependency direction is one-way:

```
routes/ → controllers/ → services/ → models/
```

A layer may only import from layers to its right. **Never** import in reverse.

`config/`, `types/` and the root-level `shared/` are cross-cutting: any layer
may import them, but they must not import from any business layer, so they stay
free of domain logic. `middleware/` may be imported by `routes/` and `app.ts`
only.

```
shared/contract.ts  Types crossing the HTTP boundary, used by src/ AND client/
src/
├── config/        Environment loading, DB connection setup
├── routes/        Route definitions + middleware mapping ONLY
├── controllers/   HTTP request/response handling + status codes
├── services/      Business logic (pure, HTTP-agnostic)
├── models/        Mongoose schemas + TypeScript interfaces ONLY
├── middleware/    Cross-cutting concerns (errorHandler.ts, auth, validation)
├── types/         Shared type definitions
├── app.ts         Express assembly; bootstrapApp opens the DB connection
├── server.ts      Process bootstrap (listen, signals, shutdown)
└── seed.ts        Resource catalogue loader (npm run seed)
```

### Per-layer rules

**`routes/`**

- Declares paths and wires them to controller methods and middleware.
- **Zero** business logic, zero inline handler bodies, zero `res.json(...)`.
- One router file per resource, exporting an `express.Router`.

**`controllers/`**

- Reads input from `req`, calls **one** service method, shapes the response,
  sets the status code.
- **No `Model.find()` / `Model.create()` / any direct DB access.**
- No business rules, no calculations, no branching on domain state.
- **Does not catch.** Express 5 forwards a synchronous throw and a rejected
  promise from a handler to the error middleware on its own, so a controller
  has no `try/catch` and no `next` parameter. Controllers never format an
  error response.

**`services/`**

- All business logic lives here. Validates domain rules, orchestrates models.
- **Never** touches `req`, `res`, `next`, HTTP status codes, or Express types.
  A service must be callable from a CLI script or a test with no HTTP present.
- Throws typed domain errors; does not decide HTTP semantics.

**`models/`**

- Mongoose schemas plus the TypeScript interface describing the document.
- Services map documents to the contract shapes; raw documents and ObjectIds
  never leave the service layer.
- No business logic beyond schema-level validation, indexes, and hooks that are
  strictly about persistence.

**`app.ts` vs `server.ts`** — `createApp()` builds and exports the configured
Express app without binding a port or opening a connection, so it stays
importable by tests. `bootstrapApp()` sits beside it and connects the database
from config before returning that app. `server.ts` owns `listen`, signals and
shutdown. Connection details live in `config/database.ts`; neither file talks
to Mongoose directly.

---

## 4. Coding Standards & Safety

### Typing

- **`any` is forbidden.** No `any`, no implicit `any`, no `as any`, no
  `@ts-ignore` / `@ts-expect-error` to silence a type error. Use `unknown` plus
  a narrowing check when a type is genuinely not known.
- Every function has explicit parameter types **and** an explicit return type,
  including `Promise<T>` on async functions. No relying on inference at
  module boundaries.
- Every Mongoose schema has a matching exported `interface` (e.g. `IBooking`),
  and the model is typed `Model<IBooking>`.
- Request/response payload shapes are declared as interfaces in `types/` or
  next to the controller — never inline object literals in a signature.
- Prefer `type`/`interface` over enums of string literals; use
  `as const` unions for fixed value sets.

### Async & error handling

- **No unhandled promises.** Never leave a floating promise (no un-awaited
  async call), and never mix `.then()/.catch()` chains into `async` code.
- **One error path.** `src/middleware/errorHandler.ts` is the only place that
  turns a failure into an HTTP response. Services throw typed domain errors;
  controllers let them travel. A `try/catch` in a controller or route is
  duplication and is removed, not added.
- Catch only where the code genuinely recovers or adds information — not to
  re-throw the same error.
- Never swallow an error silently — no empty `catch {}` blocks.
- Throw `Error` subclasses, never bare strings or object literals.
- Unknown errors must not leak stack traces or internal messages to clients.

### No escape hatches

These are the loopholes that technically satisfy the rules above while
defeating their purpose. All are forbidden:

- **Weakening the tooling to make code compile.** Never edit `tsconfig.json`,
  `eslint` config, or `package.json` scripts to disable a check that your code
  fails (`strict`, `noImplicitAny`, `exactOptionalPropertyTypes`,
  `skipLibCheck` on project files, `--transpile-only`). Fix the code instead.
- **Aliases for `any`:** `as any`, `as unknown as T`, `Object`, `{}`,
  `Function`, `Record<string, any>`, an untyped `catch (e: any)`, or an
  implicitly-typed callback parameter.
- **Suppression comments:** `@ts-ignore`, `@ts-expect-error`,
  `eslint-disable`, `eslint-disable-next-line`.
- **Schema typing escapes:** `Schema.Types.Mixed`, `strict: false`, or a
  Mongoose model declared without its interface type parameter.
- **Relocating forbidden code to dodge a layer rule.** Database access does not
  become acceptable by moving it into `middleware/`, `utils/`, `helpers/`, a
  `repositories/` folder, or `app.ts`. Data access lives in `services/` and
  `models/` — nowhere else.
- **New top-level directories under `src/`** beyond those listed in §3,
  without approval.
- **Editing this file to permit what you were asked to do.** `AGENTS.md`
  changes only on explicit instruction, never as a side effect of a task.

### Configuration & secrets

- All configuration comes from environment variables, read in `config/`, and
  validated at startup. Fail fast on a missing required variable.
- **`process.env` is referenced only inside `config/`.** Every other module
  imports the typed, validated config object.
- **Never hardcode** connection strings, ports, secrets, or API keys.
- Every new variable added to `.env` must also be added to `.env-example` with
  a placeholder value. `.env` is never committed.

### General

- No ad-hoc `console` logging in committed code. The only permitted call sites
  are deliberate startup/shutdown logging in `server.ts` and the centralized
  error-handling middleware, which must log the failure server-side before
  responding. Never use `console` for debugging leftovers.
- HTTP status codes must be accurate: `200` read, `201` create, `204` empty,
  `400` validation, `401` unauthenticated, `403` unauthorized, `404` missing,
  `409` conflict, `500` unexpected.
- All routes are versioned under `/api/v1`.
- Files use `kebab-case`, with an optional layer suffix where it aids
  navigation (`health.controller.ts`, `health.service.ts`, `domain-error.ts`).
  `src/middleware/errorHandler.ts` is the one camelCase file: the course
  deliverable names that exact path.
  Types/interfaces are `PascalCase`; variables and functions `camelCase`.
- Do not create new docs or example code unless asked. `README.md` already
  exists: when an endpoint, script or required Node version changes, update it
  in the same commit rather than letting it drift.

---

## 5. Frontend (`client/`)

React + TypeScript on Vite, in `client/`. It is a separate npm project with
its own `package.json`; the backend rules above still apply to `src/`.

```
client/src/
├── api/campushubApi.ts   Typed calls to the backend, one per contract operation
├── hooks/                Fetching and state, extracted from the components
├── components/           One component per file, with a .module.css beside it
└── App.tsx               Composition and shared state
```

- **Components are functional and take an explicit exported props interface.**
  No class components, no implicit props.
- **Fetching and state live in a custom hook under `hooks/`**, not in the
  component. A component that calls `api/` directly, or that repeats a
  `isLoading` / `error` / `try-catch-finally` block another component already
  has, is extracted. Components render; hooks talk to the server.
- A component over ~150 lines is a signal that state and rendering are tangled
  — split it before adding to it.
- **Every async path carries `isLoading` and `error` state.** A request that
  can fail needs a visible outcome in both directions; a spinner with no error
  branch is incomplete.
- **A 409 gets its own message.** `ApiError` carries the backend's `code` and
  `message`, so a conflict is reported as a conflict, not as "something went
  wrong".
- Styling is CSS Modules, one file per component. Colours come from the
  variables in `index.css`, which cover light and dark.
- **Contract types are never redeclared here.** The client imports them from
  `@contract`, the Vite and TypeScript alias for `shared/contract.ts`, which
  the backend imports too. A second copy of `Resource` or `Reservation` under
  `client/src/` is a bug waiting to drift.
- The dev server proxies `/api` to `http://localhost:3000` (see
  `vite.config.ts`), so the backend needs no CORS configuration.

---

## 6. API Contract

`docs/openapi.yaml` is the authoritative description of every HTTP endpoint.

- **The contract comes first.** To change a path, payload field, enum member or
  status code, edit the contract, then the code. Never the other way round, and
  never only one of them.
- Route paths, request/response field names and status codes in the code must
  match the contract exactly. An endpoint that is not in the contract does not
  exist.
- `shared/contract.ts` mirrors `components/schemas` and is the **only**
  declaration of those shapes in the repository; `src/` and `client/` both
  import it. Keep the names identical to the contract so a divergence is
  obvious on sight.
- Request bodies are validated at the controller boundary against the schema,
  including `additionalProperties: false` — an unexpected property is a 400,
  not something to ignore.
- Every error response body is the flat `ErrorResponse` shape
  (`{ code, message }`) defined in the contract.
- Validate the contract after editing it: `npx @redocly/cli lint
docs/openapi.yaml`. The one accepted warning is the `localhost` server URL,
  which the course requires.

---

## 7. Agent Context Hygiene

The context window is a budget. Everything an agent reads to answer a question
is paid for twice: once in tokens, and again in the odds that it edits a
generated file instead of the source it came from.

- `.cursorignore` lists what an agent must never read: `node_modules/`,
  `dist/`, `client/dist/`, lockfiles, `coverage/`, logs, source maps and
  `.env`. `.claude/settings.json` denies the same paths for Claude Code.
  Adding a generated directory means adding it to both.
- The working set is `src/`, `shared/`, `client/src/`, `docs/` and the root
  config files. Nothing else should need to be opened to make a change.
- This file is a rulebook, not a changelog. A rule that no longer describes the
  code is worse than no rule, because it will be followed. Delete stale rules
  in the same commit that makes them stale.
- Do not add a rule that `eslint.config.mjs` already enforces. Prose that
  repeats a machine check is context with no payload.

---

## 8. Git & Commit Formatting

- Commit messages follow Conventional Commits:
  `feat|fix|chore|refactor|docs|test(scope): summary`
- The subject line is imperative and <= 72 characters.
- The body explains **what was built and why**, and explicitly notes **which
  context rules from this file shaped the implementation** (e.g. "query scoped
  by tenantId per §1; DB access kept in the service layer per §3").
- Never commit `node_modules/`, `dist/`, or `.env`.
- Do not commit or push unless explicitly asked to.

---

## 9. Definition of Done

Run `npm run typecheck && npm run lint && npm run format:check` first. Most of
the rules above are machine-enforced by `eslint.config.mjs`, which cites the
section it implements next to each rule — a passing lint run is evidence, not a
substitute for reading this file. Suppressing a rule to make the run pass is
itself a violation (§4, No escape hatches).

Then verify **all** of the following:

1. No `any` (or its aliases), no suppression comments, no `.js` files added
   under `src/`.
2. `tsconfig.json`, lint config, and existing npm scripts were not weakened.
3. No new dependency was added without approval.
4. No database access outside `services/` and `models/`.
5. No business logic inside `routes/` or `controllers/`.
6. Every function at a module boundary has explicit parameter and return types.
7. No floating promises, and no `try/catch` added where the error middleware
   (§4) or an existing hook (§5) already covers the failure.
8. Tenant-owned queries are scoped by `tenantId`.
9. Any new env var is present in `.env-example`.
10. Paths, fields and status codes match `docs/openapi.yaml`, the contract
    still lints, and no contract shape was redeclared outside
    `shared/contract.ts`.
11. The server actually starts and the touched endpoints were called — type
    checking does not catch unsupported runtime syntax (§2).
12. `client/` still builds (`cd client && npm run build`) when `shared/` or any
    component changed.

If a rule was intentionally bent, say so explicitly in your response and
explain why. Do not report success while a constraint is silently violated.
