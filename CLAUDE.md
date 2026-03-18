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

## URLs

- **Website**: `https://tuldio.fr` (Astro, `apps/website/`) - marketing, CGU, confidentialite
- **App**: `https://app.tuldio.fr` (React, `apps/web/`) - the product, invite links, chat

Coding conventions are in `.claude/rules/` - auto-loaded per path.

## Mindset

- **Challenge me** — if I suggest something that smells like a hack, a shortcut, or a non-standard approach, push back. Explain the industry-standard way and let me decide. Don't just execute blindly.
- **Production-first** — every solution must be what you'd ship to real users. No "good enough for now", no "we'll fix later". If it's not production-ready, say so and propose what is.
- **Flag wrong directions early** — if I'm heading toward a pattern that will cause pain later (tight coupling, implicit state, over-engineering, missing edge cases), stop me before writing code. A 2-sentence warning saves hours of refactoring.

## Global Rules

- **Production-safe only** — every solution must be secure, validated, and production-ready
- **1 file, 1 exported function** — repositories, use-cases, controller handlers
- **No OOP** — pure exported functions. Exception: `HandledError extends Error`
- **All IDs are `crypto.randomUUID()` strings** — no auto-increment, no ObjectId
- **ESM only** — `.js` extensions in all local imports
- **French-first i18n** — all user-facing strings use i18n keys, French translation only for now
- **No null/undefined branching** — never write logic that behaves differently for `null` vs `undefined`

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

- **Tests are the source of truth for functional behavior.** Before modifying or deleting a test, the change must come from an explicit user request. Never "fix" a failing test by changing the assertion to match new code. 
- Run `pnpm typecheck` to verify no type errors
- Run `pnpm lint` to check lint rules
- Prettier runs automatically via hook on every file edit
- **Clean up dead code**: after modifying or deleting a function/component/export, check for orphaned imports, unused variables, and unreferenced files — remove them
- **Refactor when duplication creates bug risk**: if the same logic must stay in sync in multiple places, extract a shared helper — divergent duplicates cause silent bugs. Don't refactor just because two things look alike; only when they **must** behave identically. When extracting shared code, **add a test**: unit test for pure logic helpers, integration test for orchestration. No refactor without a test proving it works.

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
