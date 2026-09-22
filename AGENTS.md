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

---

## 2. Tech Stack & Libraries

### Authorized

The packages below are **pre-approved**: install them when a task genuinely
needs them. Anything not in this table requires approval first.

| Purpose  | Package                                  |
| -------- | ---------------------------------------- |
| Language | TypeScript (strict mode)                 |
| Runtime  | Node.js >= 24.21.0                       |
| HTTP     | `express`                                |
| Database | `mongoose` (MongoDB)                     |
| Config   | `dotenv`                                 |
| Types    | `@types/node`, `@types/express`          |
| Tooling  | `typescript`, `ts-node`, `eslint`, `prettier` |

### Forbidden

- **No `.js` / `.jsx` / `.mjs` / `.cjs` files under `src/`.** All source is
  `.ts`. Compiled JavaScript belongs in `dist/` and is never committed or
  hand-edited. (Root-level tooling config such as `eslint.config.mjs` is the
  only exception, and only when the tool cannot consume TypeScript.)
- **No new dependency without explicit approval** — runtime *or* dev. Do not
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

`ts-node@10` is incompatible with TypeScript 7 (it crashes in
`configuration.js` reading `ts.sys.fileExists`). It stays in `devDependencies`
because the course requires it, but **do not use it in npm scripts**. Node runs
`.ts` directly via native type stripping:

```jsonc
"dev":   "node --watch src/server.ts",
"build": "tsc",
"start": "node dist/server.js"
```

The project is **ESM** (`"type": "module"`). Consequences, both mandatory:

- Relative imports carry an explicit `.ts` extension (`./config/env.ts`).
  Node needs it to resolve the file; `tsc` rewrites it to `.js` on build via
  `rewriteRelativeImportExtensions`. Extensionless relative imports do not
  compile.
- Type-only imports use `import type { ... }`.

---

## 3. Architectural Boundaries

Strict 3-tier separation. The dependency direction is one-way:

```
routes/ → controllers/ → services/ → models/
```

A layer may only import from layers to its right. **Never** import in reverse.

`config/` and `types/` are cross-cutting: any layer may import them, but they
must not import from any business layer, so they stay free of domain logic.
`middleware/` may be imported by `routes/` and `app.ts` only.

```
src/
├── config/        Environment loading, DB connection setup
├── routes/        Route definitions + middleware mapping ONLY
├── controllers/   HTTP request/response handling + status codes
├── services/      Business logic (pure, HTTP-agnostic)
├── models/        Mongoose schemas + TypeScript interfaces ONLY
├── middleware/    Cross-cutting concerns (errors, auth, validation)
├── types/         Shared type definitions
├── app.ts         Express app assembly (no listen call)
└── server.ts      Process bootstrap (listen, DB connect, signals)
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
- Passes errors to `next(err)` — controllers do not format error responses.

**`services/`**

- All business logic lives here. Validates domain rules, orchestrates models.
- **Never** touches `req`, `res`, `next`, HTTP status codes, or Express types.
  A service must be callable from a CLI script or a test with no HTTP present.
- Throws typed domain errors; does not decide HTTP semantics.

**`models/`**

- Mongoose schemas plus the TypeScript interface describing the document.
- No business logic beyond schema-level validation, indexes, and hooks that are
  strictly about persistence.

**`app.ts` vs `server.ts`** — `app.ts` builds and exports the configured
Express app without binding a port, so it stays importable by tests.
`server.ts` owns `listen`, the DB connection, and shutdown handling.

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

- **No unhandled promises.** Every `await` on a fallible call is covered by
  `try/catch`, or the route is wrapped in an async error-handling helper.
  Never leave a floating promise (no un-awaited async call), and never mix
  `.then()/.catch()` chains into `async` code.
- Controllers catch and forward with `next(error)`; a single centralized
  error-handling middleware produces the client-facing response.
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
  navigation (`health.controller.ts`, `health.service.ts`, `error-handler.ts`).
  Types/interfaces are `PascalCase`; variables and functions `camelCase`.
- Do not create README files, docs, or example code unless asked.

---

## 5. Git & Commit Formatting

- Commit messages follow Conventional Commits:
  `feat|fix|chore|refactor|docs|test(scope): summary`
- The subject line is imperative and <= 72 characters.
- The body explains **what was built and why**, and explicitly notes **which
  context rules from this file shaped the implementation** (e.g. "query scoped
  by tenantId per §1; DB access kept in the service layer per §3").
- Never commit `node_modules/`, `dist/`, or `.env`.
- Do not commit or push unless explicitly asked to.

---

## 6. Definition of Done

Before reporting a task complete, verify **all** of the following:

1. `npx tsc --noEmit` passes with zero errors.
2. No `any` (or its aliases), no suppression comments, no `.js` files added
   under `src/`.
3. `tsconfig.json`, lint config, and existing npm scripts were not weakened.
4. No new dependency was added without approval.
5. No database access outside `services/` and `models/`.
6. No business logic inside `routes/` or `controllers/`.
7. Every function at a module boundary has explicit parameter and return types.
8. Every async path has explicit error handling; no floating promises.
9. Tenant-owned queries are scoped by `tenantId`.
10. Any new env var is present in `.env-example`.

If a rule was intentionally bent, say so explicitly in your response and
explain why. Do not report success while a constraint is silently violated.
