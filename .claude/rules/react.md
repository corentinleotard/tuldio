---
paths:
  - 'apps/web/src/**/*.ts'
  - 'apps/web/src/**/*.tsx'
---

# React — Performance & Quality

## Structure

```
apps/web/src/
  pages/              # Route-level page components
  modules/            # Feature modules (chat/, documents/, clients/, stats/, settings/)
    <name>/
      components/     # Module-specific components
      api/            # API call files (*.api.ts)
      hooks/          # Module-specific hooks
  components/         # Shared components
  components/ui/      # shadcn/ui components — don't modify unless necessary
  lib/
    api-fetch.ts      # API client (fetch wrapper with auth + silent refresh)
    i18n.ts           # i18next setup
    utils.ts          # cn() helper, formatters
    theme.ts          # Design tokens as CSS variables
  i18n/
    fr.json           # French translations
  App.tsx             # Root: router + providers
```

## Components

- **Always use shadcn/ui first** — check `components/ui/` before building anything. Never reimplement what exists.
- If a needed component doesn't exist in shadcn, create it in `components/ui/` so it's reusable
- Colocate module-specific components in `modules/<name>/components/`
- Only truly shared components go in `components/`
- Keep components under ~150 lines — extract subcomponents when too big
- Prefer composition over props drilling — use children, render props, or context

## Styling

- **Tailwind CSS only** — never inline `style={{}}` objects, never CSS modules
- Use semantic color tokens via CSS variables (`bg-background`, `text-primary`, `border-border`)
- Dark mode via `class` strategy — Tailwind `dark:` prefix, follows system preference
- All spacing on the 4px grid via Tailwind classes (`p-1` = 4px, `p-2` = 8px, `p-4` = 16px)
- Use `cn()` helper (from `lib/utils`) for conditional class merging

```tsx
// BAD — inline styles, hardcoded values
<div style={{ padding: 16, backgroundColor: '#1B4D3E' }}>

// GOOD — Tailwind + semantic tokens
<div className="p-4 bg-primary">

// GOOD — conditional classes
<div className={cn("p-4 rounded-lg", isActive && "bg-primary text-white")}>
```

## Responsive Design

- Mobile-first: write base styles for mobile, add `md:` and `lg:` for larger screens
- Bottom tab bar on mobile → sidebar on desktop (`lg:` breakpoint)
- Use Tailwind responsive prefixes exclusively — never JS-based breakpoint detection
- Touch targets: `min-h-12` (48px) on mobile, `min-h-9` (36px) on desktop

## Typography

- Base font size: 16px minimum — users have tired eyes
- System fonts (no custom font loading for V1)
- Heading: 20-24px, `font-semibold`
- Body: 16px, `font-normal`
- Small/meta: 14px — never smaller (`text-sm` minimum)
- Amounts/prices: 18-20px, `font-bold` — money must be instantly scannable

## Effects & Cleanup

- Every `useEffect` that creates a subscription, interval, timeout, or event listener MUST return a cleanup function — forgetting it causes memory leaks and stale callbacks
- Always verify: "if this effect re-runs or unmounts, is the previous one properly torn down?"

## Performance

- Memoize expensive computations with `useMemo`
- Use `useCallback` for functions passed as props to child components
- Never create objects/arrays inline in JSX props — extract to constants or useMemo
- Avoid `.filter().map()` chains — combine into a single `.reduce()` or single loop
- Use `key` on lists that is stable and unique — never array index on dynamic lists
- Virtualize long lists with `@tanstack/react-virtual`

## State

- TanStack Query for all server data (`useQuery`, `useMutation`) — never cache API data in Zustand
- **React Query cache is the single source of truth for server data** — never duplicate it into `useState`
- After mutations (create, update, send), update the cache via `queryClient.setQueryData` (optimistic) or `queryClient.invalidateQueries` — never maintain a parallel local state
- Read data with `useQuery`, write back with `setQueryData` or invalidation — no `useEffect` sync loops
- Zustand only for client-only state (UI toggles, current chat input) — not the default choice
- Prefer derived state over synced state — compute from existing data instead of storing separately
- Never `useEffect` to sync state — it's almost always wrong data flow

## API files (`modules/*/api/*.api.ts`)

- Use `apiFetch<T>()` from `@/lib/api-fetch` for all HTTP calls — never raw `fetch`
- Import types from `@tuldio/common` only
- Never import from `@tuldio/core` (that's backend-only)
- Path alias `@/` maps to `./src/`

## Navigation

- React Router (routes + layout components)
- Bottom tabs on mobile: Chat | Documents | Clients | Stats (4 tabs max)
- Sidebar on desktop (lg: breakpoint): same 4 sections + settings
- Settings accessible from profile icon in header (mobile) or sidebar bottom (desktop)

## Forms & Validation

- Use `react-hook-form` for forms (settings, manual client creation)
- **Mirror backend validation on the frontend** — show inline errors before submission
- Email fields: validate format, trim, lowercase before sending

## Chat-Specific Rules

- Chat is the primary screen — optimize for speed and smoothness
- Virtualized message list, newest at bottom
- Show typing indicator while AI processes
- Rich cards (PDF previews, stat summaries) are custom components in the message list
- Camera button (via Capacitor Camera plugin on mobile, file input on web) always visible in input bar
- Input bar sticks above keyboard on mobile — never hidden behind it

## Capacitor

- Native features accessed via Capacitor plugins: Camera, PushNotifications, Haptics, Preferences
- Feature detection: check `Capacitor.isNativePlatform()` before using native-only APIs
- Web fallbacks: file input for camera, Web Push API for notifications
- Never import Capacitor plugins at the top level in shared code — lazy-import behind platform checks

## i18n

- All user-facing strings use i18n keys — never hardcode French text in components
- Translation keys in `i18n/fr.json` — flat namespace, dot-separated: `"chat.send"`, `"stats.revenue"`
- Dates/numbers: use `Intl.DateTimeFormat('fr-FR')` and `Intl.NumberFormat('fr-FR')`
- Currency: always `€` suffix, French spacing: `1 200,50 €`

## Accessibility

- High contrast ratios (WCAG AA minimum, 4.5:1 for text)
- `aria-label` on all icon-only buttons
- Semantic HTML (`button`, `nav`, `main`, `section`) — not divs for everything
- Keyboard navigation on desktop — all flows usable without mouse
- Support system font scaling

## Types

- Props interfaces go in the same file as the component — not in a separate types file
- Use `ComponentProps<typeof X>` to extend existing component props
