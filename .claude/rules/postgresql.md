# PostgreSQL — Queries & Conventions

## Raw pg (node-postgres)

- All queries are raw parameterized SQL — no ORM
- Connection pool in `packages/core/src/lib/database/db.ts`
- Schemas validated with Zod at insert boundaries
- Migrations are plain `.sql` files in `packages/core/src/lib/database/migrations/`

## Why no ORM

- The AI generates SQL queries directly — an ORM is a middleman that produces worse SQL
- Raw SQL is faster, more predictable, and easier for Claude to generate
- Zod handles type safety on inputs and outputs

## Team-scoped queries

- ALL business data queries MUST include `WHERE team_id = $N` — enforced at repository layer
- Messages are scoped by `user_id` (each user has their own chat conversation)
- Never trust client-provided teamId or userId — always use the ones from auth middleware
- Repository functions receive `teamId` (and `userId` where needed) as required parameters
- Auth middleware extracts both `userId` and `teamId` from JWT → attaches to `req`

## Query patterns

- Always use parameterized queries: `db.query('SELECT ... WHERE id = $1', [id])`
- NEVER interpolate values into SQL strings
- Use `RETURNING *` on inserts/updates when you need the result
- Prefer batch operations: `INSERT INTO ... VALUES ($1), ($2)` over loops
- Use `WHERE id = ANY($1::uuid[])` for batch lookups
- Amounts stored as integers (cents) — never floats
- Use `COALESCE` for aggregations that may return null

## AI-generated queries

- Claude generates standard SQL for stats/reports queries
- All AI-generated queries MUST use parameterized placeholders ($1, $2...)
- AI-generated queries MUST always include `WHERE team_id = $1` — injected server-side, never from AI
- AI queries are validated before execution — never execute arbitrary SQL
- A query allowlist or validator ensures only SELECT queries run from chat context

## Safety

- Never use string interpolation for SQL — always parameterized
- Add `LIMIT` to potentially large result sets
- Use transactions for multi-table writes: `db.query('BEGIN')` ... `db.query('COMMIT')`
- AI-generated queries run with a read-only connection pool (SELECT only)
