# Crons App — Conventions

## Structure

```
apps/crons/src/
  index.ts          # DB connect + import all job files
  lib/
    schedule.ts     # Wrapper: schedule({ name, expression, fn }) — global try/catch + logging
  jobs/
    *.ts            # 1 file = 1 cron job, calls schedule() at module level
```

## Rules

- **1 file, 1 cron** — never put multiple schedules in one file
- **No try/catch around `schedule()`** — the wrapper handles it
- **Business logic lives in `@tuldio/core`** — cron files only orchestrate calls
- Use `logger` from `@tuldio/core/lib` for any additional logging
