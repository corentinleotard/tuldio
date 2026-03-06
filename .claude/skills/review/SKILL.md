---
name: review
description: Review changed code for bugs, edge cases, security, performance, and convention violations. Fixes all issues found.
---

Review the code changes in the current branch (or staged/unstaged changes if on main). $ARGUMENTS

## Process

1. **Gather changes** — run `git diff HEAD` (or `git diff main` if on a feature branch) to see all modified code. Read full files for context around each change.

2. **Run checks** — execute `pnpm typecheck` and `pnpm lint` to catch mechanical issues first.

3. **Deep review** — analyze every change against ALL categories below. Be thorough and skeptical. Assume bugs exist until proven otherwise.

## Review categories

### Bugs & logic errors
- Off-by-one errors, wrong operators, inverted conditions
- Null/undefined access on optional fields or empty arrays
- Async issues: missing `await`, unhandled promise rejections, race conditions
- Wrong variable reused (copy-paste bugs)
- Incorrect return types or return values silently accepted by TypeScript (`any`, type assertions)

### Functional correctness
- Does the code actually do what the commit/PR description says?
- Are there misunderstandings of the business domain or existing data model?
- Does the happy path work AND does the error path behave correctly?
- Are status transitions / state machines respected?

### Edge cases
- Empty arrays, empty strings, undefined optional fields
- Concurrent calls — what if this runs twice simultaneously?
- First-time use (no data yet) vs. steady state
- Large datasets — does this scale or will it OOM / timeout?
- What happens when an external call (DB, API, AI) fails mid-operation?

### Breaking existing flows
- Does this change break callers of modified functions? Check all import sites.
- Are existing API contracts preserved? (response shape, status codes, error codes)
- Does renaming/removing a field break the frontend or other consumers in `packages/types`?
- Are database queries still valid after schema changes? (missing migrations, stale indexes)
- Do cron jobs or background workers still work with the new data shape?

### Security (OWASP top 10)
- Injection: unsanitized user input in queries, shell commands, HTML
- Broken access control: missing `teamId` scoping, unauthorized data access
- Sensitive data exposure: secrets in logs, tokens in responses
- Mass assignment: accepting raw user objects into DB updates

### Dead code & duplication
- Unused imports, variables, parameters, exports left behind
- 70%+ duplicated logic that should be a shared helper
- Orphaned files after renames or deletions

### Performance
- N+1 queries (loop of `findOne` instead of batch)
- Missing projections (fetching full rows for 2 fields)
- Unbounded queries without `LIMIT`
- Unnecessary re-renders or re-fetches on the frontend

### Convention violations
- Positional args instead of single object param (2+ args)
- Missing `teamId` / `userId` scoping in repository queries
- Missing `.js` in import paths
- OOP classes where a plain function would do
- Missing `schema.parse()` on inserts

## Output

For each issue found:
1. State the file, line, and category
2. Explain WHY it's a problem (not just what rule it breaks)
3. Fix it immediately

If no issues are found in a category, skip it — don't list clean categories.

After all fixes, re-run `pnpm typecheck && pnpm lint` to confirm nothing is broken.
