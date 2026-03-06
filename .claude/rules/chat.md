# Chat & Rich Cards — Conventions

## Architecture

```
apps/web/src/modules/chat/
  components/
    chat-message-list.tsx   # Virtualized message list, renders bubbles + rich cards
    message-bubble.tsx      # Single message bubble (user or assistant)
    rich-card-*.tsx          # Rich card components (quote, invoice, expense, stats, client_picker)
    typing-indicator.tsx     # AI thinking animation
    chat-input.tsx           # Message input bar
packages/core/src/lib/ai/
  system-prompt.ts          # AI system prompt (personality, rules, tool instructions)
  tool-registry.ts          # Tool definitions (zod schema + handler) — the AI's capabilities
  build-context.ts          # Context summary builder for older messages
  chat-orchestrator.ts      # Message processing loop (Claude API + tool execution)
```

## Rich Cards — Snapshot + Live Data

Rich cards are stored as **snapshots** in the `messages` table (`rich_card` JSONB column). This means the data shown is frozen at creation time.

**Critical rule: never rely on snapshot data for actions.**

- Display data (amounts, lines, status labels) → use the snapshot, it's fine
- Action data (client email, client address, current status) → **fetch live from API** when the action is triggered
- Rich card data always embeds entity IDs (`clientId`, `id`, `quoteId`) — use these IDs to fetch fresh data at action time

Example pattern for an action button:
```tsx
async function handleAction() {
  setLoading(true);
  try {
    // Fetch live data — never trust snapshot for actions
    const client = await apiFetch<ClientView>(`/api/clients/${data.clientId}`);
    // Use live data for the action
    doSomething(client.email);
  } finally {
    setLoading(false);
  }
}
```

**Why**: a client may not have had an email when the card was created, but the user may have added one since. Or an invoice status may have changed. Snapshots go stale — IDs don't.

## Rich Card Types

| Type | Component | Data | Actions |
|------|-----------|------|---------|
| `quote` | `RichCardQuote` | `QuoteView` | Envoyer par email, Consulter (download PDF) |
| `invoice` | `RichCardInvoice` | `InvoiceView` | Envoyer par email, Consulter (download PDF) |
| `expense` | `RichCardExpense` | `ExpenseView` | Display only |
| `stats` | `RichCardStats` | `MonthlyStatsView` | Display only |
| `client_picker` | `RichCardClientPicker` | `ClientView[]` | Select a client (one-time) |

## Document Sharing Flow (Envoyer par email)

1. User clicks "Envoyer par email" on a quote/invoice card
2. Frontend fetches client's **current** email via `GET /api/clients/:id`
3. If email exists → `shareDocument()` (navigator.share on mobile, download + mailto on desktop)
4. If no email → inject chat message so AI asks the user for the client's email, then saves it via `update_client`
5. The app opens the user's mail client — we never send emails server-side (the artisan sends their own emails)

## AI Tool Registry

- Tools are defined in `tool-registry.ts` using `defineTool({ name, description, schema, handler })`
- Schema is zod — auto-converted to JSON Schema for Claude API
- Each tool returns `{ result, richCard? }` — richCard is optional and gets stored in the message
- Tool descriptions are in French — they guide the AI on when/how to use each tool
- Context summaries of older tool calls are built in `build-context.ts` to keep the AI aware of past actions

### ID parameters — current context only

Every ID parameter in a tool schema (clientId, quoteId, invoiceId…) MUST include `(du contexte actuel uniquement)` in its `.describe()`. This tells the AI agent to only use IDs from the current tool call results, never from the history summary.

- The history summary in `build-context.ts` is labeled as stale — IDs there must not be reused
- The AI gets fresh IDs from tool results in the current conversation turn
- This is the standard agent loop pattern: tool results feed into the next tool call via conversation history
- When adding or modifying a tool, always annotate ID params with this convention

## AI System Prompt

- Lives in `system-prompt.ts` — single function, returns the full prompt string
- Personality: friendly, tu-tutoie, professional, French only
- Contains strict rules for client resolution, document generation, email flow
- The AI cannot send emails — it can only ensure client data is complete so the app can handle it

## Adding a New Rich Card Type

1. Add the view type to `@tuldio/types`
2. Create `rich-card-{type}.tsx` in chat components
3. Add case to `renderRichCard()` in `chat-message-list.tsx`
4. Return `richCard: { type, data }` from the tool handler in `tool-registry.ts`
5. Add a describer in `build-context.ts` for context summaries
