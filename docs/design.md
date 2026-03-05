# Tuldio — Design

## Design Philosophy

The app should feel like texting a friend, not using software. Every screen that isn't the chat is a failure. The target user is intimidated by technology — design must be invisible.

## Interface

### Primary Screen: Chat
- Full-screen chat interface (like iMessage/WhatsApp)
- Text input + camera button + voice button (future)
- AI responses include inline actions: "Envoyer le devis ?" [Oui] [Modifier]
- Documents (quotes, invoices) shown as rich cards in the chat with PDF preview
- Typing indicator when AI is processing

### Secondary Screens (minimal)
- **Templates**: upload/manage quote and invoice templates (accessed rarely, only during setup)
- **Documents**: scrollable list of quotes + invoices with status badges (sent/accepted/paid/overdue)
- **Clients**: alphabetical list with search, tap to see history
- **Stats**: simple cards — revenue this month, unpaid total, year-over-year (V2: charts)
- **Settings**: profile, subscription, notification preferences

### Navigation
- Bottom tab bar: Chat | Documents | Clients | Stats
- Chat tab has a badge for unread AI messages (proactive alerts)
- No hamburger menus, no nested navigation, no settings buried 3 levels deep

## Visual Identity

### Colors

**Light theme (default):**
- Background: `#F8F7F4` (warm off-white, paper-like, readable in sunlight)
- Surface: `#FFFFFF` (cards, chat bubbles, documents)
- Primary: `#1B4D3E` (deep forest green — trustworthy, calm, not corporate)
- Primary light: `#2D7A5F` (buttons, links)
- Accent: `#E8913A` (warm orange — CTAs, badges, notifications)
- Text: `#1A1A1A` (near-black, high contrast)
- Text secondary: `#6B6B6B`
- Success: `#2D7A5F` (paid, accepted)
- Warning: `#E8913A` (overdue, pending)
- Error: `#C4392D` (refused, failed)

**Dark theme (optional, follows system preference):**
- Background: `#121212`
- Surface: `#1E1E1E`
- Primary: `#4CAF82` (lighter green for dark backgrounds)
- Same accent/status colors, adjusted for dark contrast

**Why light default:** artisans use their phone outdoors, in bright sunlight, on job sites. Dark screens are unreadable in direct light. Light background + dark text = readable anywhere. Dark mode available for evening admin at home.

### Typography
- Large base font size (16-18px) — these users have calloused hands and tired eyes
- Clear hierarchy: bold for amounts, regular for descriptions
- No fancy fonts — system fonts (San Francisco / Roboto) for speed and clarity

### Tone of Voice
- Friendly, tutoyant (tu, not vous) — unless the user prefers formal
- Short sentences, plain French — no jargon, no anglicisms
- Confirm actions clearly: "J'ai créé le devis n°2025-012 pour Martin Jean. Tu veux que je lui envoie ?"
- Admit uncertainty: "J'ai lu 847€ sur la facture, c'est correct ?" — never guess silently

### Document Style
- Generated PDFs match the user's uploaded template exactly
- Professional output regardless of how casual the input was
- "fais un devis martin jean carrelage 30m2 50€" → clean, formatted, professional PDF

## Responsive Design

Mobile-first, but every screen must work beautifully on desktop too. Same codebase serves both — Capacitor wraps the web app for App Store / Play Store distribution.

### Breakpoints

| Name | Min width | Layout |
|------|-----------|--------|
| `mobile` | 0px | Single column, bottom tab bar, full-width cards |
| `tablet` | 768px | Wider cards, side-by-side stats, more breathing room |
| `desktop` | 1024px | Sidebar navigation replaces bottom tabs, split-pane chat, max-width container |

### Mobile (default)
- Bottom tab bar: Chat | Documents | Clients | Stats
- Full-width cards, stacked layout
- Chat is full-screen
- Camera button prominent in chat input

### Desktop (1024px+)
- Left sidebar with navigation (replaces bottom tabs)
- Chat: split pane — conversation on left (max 600px), document preview or context panel on right
- Documents/Clients: list on left, detail on right (master-detail)
- Stats: 2x2 or 3-column card grid
- Settings in a modal or right panel, not a full page
- Max content width: 1200px, centered

### Key Rules
- Use Tailwind responsive prefixes (`md:`, `lg:`) — never JS-based breakpoint detection
- Touch targets: 48px minimum on mobile, 36px minimum on desktop
- No hover-only interactions — everything must work on touch
- Test on a 5-year-old Android phone — not just the latest MacBook

## Mobile App (Capacitor)

- Camera via Capacitor Camera plugin — snap receipt, done, back to work
- Push notifications via Capacitor Push Notifications — max 2-3/week, always actionable
- Offline support for viewing existing documents (generate when back online)
- App bundle < 15MB (web assets), native shell adds ~5MB

## Accessibility

- High contrast ratios (WCAG AA minimum)
- Large touch targets (48px mobile, 36px desktop)
- No gesture-only interactions — everything has a visible button alternative
- Support for system font scaling
- Keyboard navigation on desktop — all flows usable without mouse
