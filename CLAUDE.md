# Tuldio — Monorepo

> "Tu lui dis, c'est fait." — AI-powered business assistant for French TPE/PME.
> Quotes, invoices, expenses, client management, business stats — all through chat.

## Architecture

```
apps/
  api/          # Express REST API (HTTP layer only)
  web/          # React + Vite + shadcn/ui + Tailwind — responsive web app (Capacitor for mobile)
  crons/        # Scheduled jobs (1 file per cron, wrapper in src/lib/schedule.ts)
packages/
  core/
    src/
      modules/  # Domain modules (clients, quotes, invoices, expenses, teams, auth, users, stats, messages)
      lib/
        database/   # db.ts, connection pool (raw pg + Zod validation)
        errors/     # error-codes.ts, handled-error.ts
        infra/      # logger.ts, id.ts
        ai/         # Claude API client, chat orchestration
        storage/    # Local disk file storage (PDFs, receipts, documents)
  types/        # API contract types (shared between API and web)
```

Coding conventions are in `.claude/rules/` — auto-loaded per path.

## Global Rules

- **Production-safe only** — every solution must be secure, validated, and production-ready
- **1 file, 1 exported function** — repositories, use-cases, controller handlers
- **No OOP** — pure exported functions. Exception: `HandledError extends Error`
- **All IDs are `crypto.randomUUID()` strings** — no auto-increment, no ObjectId
- **ESM only** — `.js` extensions in all local imports
- **French-first i18n** — all user-facing strings use i18n keys, French translation only for now

## Data Model

Tables: `teams`, `users`, `clients`, `quotes`, `invoices`, `expenses`, `messages`.
Schemas defined in each module's `domain/*.entity.ts`. Migrations in `packages/core/src/lib/database/migrations/`.

Business data scoped by `team_id`. Messages scoped by `user_id` (each user has their own chat).
Row-level security enforced at repository layer — all queries MUST include team_id or user_id.

## Commands

```bash
pnpm dev              # Launch api + web + crons
pnpm dev:api          # API only (port 3003)
pnpm dev:web          # Vite dev server (port 5174)
pnpm dev:crons        # Crons only
pnpm lint             # ESLint
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier
pnpm typecheck        # TypeScript (all workspaces)
pnpm db:migrate       # Apply pending SQL migrations
```

## After Code Changes

- Run `pnpm typecheck` to verify no type errors
- Run `pnpm lint` to check lint rules
- Prettier runs automatically via hook on every file edit
- **Clean up dead code**: after modifying or deleting a function/component/export, check for orphaned imports, unused variables, and unreferenced files — remove them
- **Refactor over duplication**: before writing a block of logic, check if the same pattern already exists in the module — extract a shared helper instead of copying. When two functions/components/handlers share 70%+ logic, refactor into a single reusable piece with parameters — applies to both frontend and backend. **Never copy-paste code. If it exists, reuse it. If it almost exists, generalize it.**

## Error Handling

- Throw `new HandledError(errorCodes.xxx)` in use-cases
- Error codes in `packages/core/src/lib/errors/error-codes.ts`
- API error middleware catches HandledError → structured JSON
- Frontend `apiFetch` parses errors → toast handler

## Environment Variables

- `PORT` — API port (default: 3003)
- `VITE_API_URL` — Frontend API base URL (default: http://localhost:3003)
- `DATABASE_URL` — PostgreSQL connection string
- `ANTHROPIC_API_KEY` — Claude API key
- `FILES_DIR` — Local file storage path (default: /var/tuldio/files)
- `RESEND_API_KEY` — Transactional emails (OTP codes)
- `JWT_SECRET` — Auth token signing (min 32 chars)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Payments
