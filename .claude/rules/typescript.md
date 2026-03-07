# TypeScript conventions

## Function parameters

- Use a single object parameter for functions with 2+ parameters — never multiply positional args
- Example: `function createQuote(input: { userId: string; clientId: string; lines: Line[] })`
- NOT: `function createQuote(userId: string, clientId: string, lines: Line[])`
- Exception: single-parameter functions can use a plain value

## Null convention

- Use `null` for explicit "no value" — not `undefined`
- If a value is optional, type it as `T | null`

## Dead parameter cleanup

- After modifying a function, check if all parameters in its input object are still used in the body — remove any that aren't
- Check all callers when removing a parameter — update call sites to stop passing the removed field
