# Core Package — DDD Layers

## Domain files (`domain/`)

- **Entity schemas** via Zod: define shape + constraints, export `type *Row = z.infer<typeof schema>`
- Pure logic functions: validation, computation, transformation — no I/O, no side effects
- Business validation lives here — export reusable validators
- Must be 100% unit testable without mocks
- Only synchronous code, NO ASYNC

## Repository files (`repository/*.ts`)

- 1 file = 1 exported async function (e.g. `insertClient`, `findQuotesByUser`)
- Use parameterized raw SQL via `db.query()` from `../../../lib/database/db.js`
- Use `generateId()` from `../../../lib/infra/id.js` for new records
- Insert functions validate with Zod schema before writing
- Return plain objects — never expose pg internals
- File naming: `find-*.ts`, `insert-*.ts`, `delete-*.ts`, `update-*.ts`
- All queries MUST filter by `teamId` (or `userId` for messages) — enforced at this layer

## Use-case files (`use-cases/*.ts`)

- 1 file = 1 exported async function
- Orchestrates domain functions + repository calls
- Returns `@tuldio/common` views — never raw DB rows
- Throws `new HandledError(errorCodes.xxx)` for domain errors
- Validate all inputs using domain validators before any DB operation
- **Never use dynamic imports inside function bodies** — all imports must be top-level `import` statements at the top of the file. No `await import(...)` inside functions.

## Module boundary

- `index.ts` barrel export = public API of the module
- Other modules call use-cases only — never reach into another module's repository
- All import paths use `.js` extension (ESM)
