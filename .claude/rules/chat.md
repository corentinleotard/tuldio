# Chat & Rich Cards — Conventions

## File Map

```
apps/web/src/modules/chat/components/
  chat-message-list.tsx   # Virtualized message list, renders bubbles + rich cards
  message-bubble.tsx      # Single message bubble (user or assistant)
  rich-card-*.tsx          # Rich card components (quote, invoice, expense, stats, client_picker)
  typing-indicator.tsx     # AI thinking animation
  chat-input.tsx           # Message input bar

packages/core/src/lib/ai/
  system-prompt.ts          # AI system prompt
  tool-registry.ts          # Tool definitions (zod schema + handler)
  build-context.ts          # Builds Claude message array from stored messages
  chat-orchestrator.ts      # Message processing loop (Claude API + tool execution)
```

## Rules for modifying chat/AI code

### STOP — Read before touching the prompt

The system prompt was rewritten on 2026-03-07 to fix a critical context-bleed bug.
The root cause was: too much hardcoded flow logic in the prompt, duplicated tool descriptions, and stale context leaking between tasks.

**Before adding ANYTHING to `system-prompt.ts`, answer these 3 questions:**

1. **Is this a principle or a procedure?** The system prompt only contains principles (identity, tone, safety rails). If it's a procedure ("when X happens, do Y"), it belongs in a tool description, not the prompt.
2. **Does this already exist in a tool description?** If yes, don't duplicate it. If the tool description is insufficient, improve it there.
3. **Will this grow the prompt?** Every line added to the prompt is a line that can conflict with tool descriptions, leak tool names, or bias the AI toward old context. The prompt should stay under 40 lines. If you're adding a line, remove one.

If you cannot answer all 3, do NOT modify the prompt. Open a discussion first.

### Modification rules

- **Never duplicate logic between system prompt and tool descriptions.** Flow logic (when to confirm, what to ask) belongs in the tool's `description` field only.
- **System prompt = principles, not procedures.** It defines identity, tone, and safety rails. It must never reference tool names or script conversation flows.
- **Tool descriptions are the single source of truth** for how each tool should be used. They are in English for better instruction following.
- **Every ID parameter** in a tool schema MUST include `(from current conversation tool results only)` in its `.describe()`.
- **Run `pnpm eval` after any change** to system prompt, tool descriptions, or context building. These tests assert on tool call behavior. If an eval fails, your change broke something — revert first, think second.

## Rich Cards — Snapshot + Live Data

Rich cards are stored as **snapshots** in the `messages` table (`rich_card` JSONB column). Data is frozen at creation time.

**Critical rule: never rely on snapshot data for actions.**

- Display data (amounts, lines, status labels) → use the snapshot
- Action data (client email, current status) → **fetch live from API** when the action is triggered
- Rich card data embeds entity IDs — use these to fetch fresh data at action time

## Rich Card Types

| Type | Component | Data | Actions |
|------|-----------|------|---------|
| `quote` | `RichCardQuote` | `QuoteView` | Envoyer par email, Consulter (download PDF) |
| `invoice` | `RichCardInvoice` | `InvoiceView` | Envoyer par email, Consulter (download PDF) |
| `expense` | `RichCardExpense` | `ExpenseView` | Display only |
| `stats` | `RichCardStats` | `MonthlyStatsView` | Display only |
| `client_picker` | `RichCardClientPicker` | `ClientView[]` | Select a client (one-time) |

## Adding a New Rich Card Type

1. Add the view type to `@tuldio/types`
2. Create `rich-card-{type}.tsx` in chat components
3. Add case to `renderRichCard()` in `chat-message-list.tsx`
4. Return `richCard: { type, data }` from the tool handler in `tool-registry.ts`

## Adding a New Tool

1. Define with `defineTool()` in `tool-registry.ts` — description must be self-documenting
2. Add to `allTools` array
3. If the tool returns a rich card, add the card type (see above)
