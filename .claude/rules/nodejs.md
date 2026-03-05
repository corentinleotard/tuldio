---
paths:
  - 'apps/api/src/**/*.ts'
  - 'apps/crons/src/**/*.ts'
  - 'packages/core/src/**/*.ts'
---

# Node.js — Performance & Safety

## Event loop

- Never block the event loop — no synchronous I/O, no CPU-heavy loops on the main thread
- Prefer `Promise.all()` for independent async operations — never sequential `await` in a loop when calls are independent
- Use `for...of` with `await` only when operations must be sequential (order matters, rate limiting)

## Bulk operations

- Prefer bulk DB operations over loops — batch INSERT over looping single inserts
- Batch external API calls where possible — collect IDs, make one call
- When processing large arrays, prefer streaming or chunked processing over loading everything into memory

## Complexity

- Avoid O(n^2) patterns — no nested `.find()` / `.includes()` inside loops
- Use `Map` or `Set` for lookups inside loops instead of repeated `.find()` on arrays
- Prefer `.reduce()` to build a Map once, then look up in O(1)

```ts
// BAD — O(n * m)
for (const client of clients) {
  const quote = quotes.find((q) => q.client_id === client.id);
}

// GOOD — O(n + m)
const quotesByClient = new Map<string, Quote>();
for (const quote of quotes) {
  quotesByClient.set(quote.client_id, quote);
}
for (const client of clients) {
  const quote = quotesByClient.get(client.id);
}
```

## Error handling

- Always handle promise rejections — unhandled rejections crash the process
- Use `HandledError` for expected business errors, let unexpected errors bubble to the global handler
- Never swallow errors silently (`catch () {}`) — at minimum log them

## Security

- Never interpolate user input into shell commands, DB queries, or HTML
- Validate and sanitize all external input at the boundary (controller layer)
