---
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# Import Conventions

- ESM only — all import paths for local files use `.js` extension (e.g. `./collection.js`)
- Use `import type { ... }` or `import { type ... }` for type-only imports
- Workspace packages: `@tuldio/core/clients`, `@tuldio/core/quotes`, `@tuldio/core/lib`, `@tuldio/common`
- Never import from `@tuldio/core` root — always use subpath exports
- Web app (`apps/web`): never import from `@tuldio/core` — only from `@tuldio/common` (core is backend-only)
- Web app uses `@/` path alias for `./src/` — prefer `@/lib/...`, `@/components/...` over relative paths
