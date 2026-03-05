---
paths:
  - 'apps/web/src/**/*'
---

# Design System

## Direction

Warm, approachable, trustworthy. NOT corporate SaaS, NOT generic AI slop (no purple gradients, no floating cards with heavy shadows). Think: a well-designed tool that feels like a person helping you, not software you're fighting. The user is an artisan, not a developer.

## Color Tokens

Use ONLY semantic tokens — never hardcode hex values in components.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background` | `#F8F7F4` | `#121212` | Page/screen background |
| `surface` | `#FFFFFF` | `#1E1E1E` | Cards, chat bubbles, modals |
| `primary` | `#1B4D3E` | `#4CAF82` | CTAs, key actions, brand |
| `primaryLight` | `#2D7A5F` | `#5CC496` | Buttons, links, active states |
| `accent` | `#E8913A` | `#E8913A` | Notifications, badges, highlights |
| `text` | `#1A1A1A` | `#E8E8E8` | Primary text |
| `textSecondary` | `#6B6B6B` | `#9E9E9E` | Secondary text, labels |
| `border` | `#E5E2DC` | `#2E2E2E` | Borders, dividers |
| `success` | `#2D7A5F` | `#4CAF82` | Paid, accepted, positive |
| `warning` | `#E8913A` | `#E8913A` | Overdue, pending, attention |
| `error` | `#C4392D` | `#EF5350` | Refused, failed, destructive |

All tokens defined in a single theme file. Components import from theme, never from raw values.

## Typography

- System fonts only (San Francisco on iOS, Roboto on Android, system stack on web)
- Base: 16px regular — the default for all body text
- Small: 14px — captions, secondary info. Never smaller than 14px.
- Heading: 20-24px semibold
- Section title: 18px semibold
- Amounts/prices: 18-20px bold — money must pop instantly
- Never go above 28px. Restraint is the point.

## Spacing

Base unit: 4px grid. Use named spacing constants, not raw numbers.

| Name | Value | Usage |
|------|-------|-------|
| `xs` | 4px | Tight inline gaps |
| `sm` | 8px | Between related items |
| `md` | 16px | Standard padding, section gaps |
| `lg` | 24px | Between sections |
| `xl` | 32px | Page padding, major sections |
| `xxl` | 48px | Screen-level breathing room |

Let content breathe — when in doubt, add more whitespace, not less.

## Surfaces & Elevation

- Cards: light border, subtle background, small radius (8-12px). No heavy shadows.
- Chat bubbles: user = primary color, AI = surface color. Rounded corners (16px).
- Modals/sheets: medium shadow — the only place for noticeable shadow.
- No nested cards. If you need hierarchy, use a slightly different background shade.
- Status badges: small, rounded-full, colored background with white text.

## Interaction & Motion

- Press feedback: subtle opacity change (0.7) on touchable elements
- Transitions: under 200ms — state changes should feel instant
- Loading: simple spinner or skeleton, never a full-screen loader for chat
- No decorative animations. Motion is only for feedback (sending, loading, success).
- Pull-to-refresh on lists

## Status Indicators

Consistent across the entire app:

| Status | Color | Badge text |
|--------|-------|------------|
| Draft | `textSecondary` | Brouillon |
| Sent | `primary` | Envoyé |
| Accepted | `success` | Accepté |
| Refused | `error` | Refusé |
| Paid | `success` | Payé |
| Overdue | `warning` | En retard |
| Pending | `warning` | En attente |

## Number & Currency Formatting

- Always French locale: `1 200,50 €` (space as thousands separator, comma as decimal, € after)
- Percentages: `22,5 %` (space before %)
- Dates: `12 mars 2025` (no leading zero, month name in lowercase)
- Short dates: `12/03/2025` (DD/MM/YYYY — never MM/DD)

## Empty States

- Never show a blank screen or just "Pas de données"
- Always: icon + short message + CTA
- Example: "Pas encore de devis. Envoyez votre premier devis dans le chat !"
- Warm, encouraging tone — not clinical

## Component Library

- **shadcn/ui** — the component library for all UI. Lives in `apps/web/src/components/ui/`.
- Design tokens defined as CSS variables in the root stylesheet — consumed by Tailwind + shadcn
- Same codebase serves web browser and Capacitor mobile — no separate implementations
- When shadcn doesn't have a component you need, build it in `components/ui/` using the same token system

## Rules

- **Always use the design system** — check `components/ui/` before building anything. Never reimplement what exists. Never build one-off styled components inline.
- If a component you need doesn't exist, add it to `components/ui/` — not as a local one-off
- Every interactive element needs visible focus/press styles
- Test on a 5-year-old Android phone — not just the latest iPhone
- Dark mode: supported via theme swap, follows system preference. Never use platform-specific dark: prefixes — always go through theme tokens.
- Icons: `lucide-react` everywhere. Import individually, never barrel export.
