---
name: debug-chat
description: Debug AI chat behavior — trace tool calls, demand state, and AI decisions for a specific conversation or message.
---

Debug why the AI chat assistant took a specific path. $ARGUMENTS

## Context

- **Database**: PostgreSQL via `docker exec tuldio-postgres psql -U postgres -d tuldio -c "..."`
- **Messages table**: `messages` — columns: `id`, `user_id`, `team_id`, `role` (user/assistant), `content`, `tool_calls` (JSONB), `rich_card` (JSONB), `debug_trace` (JSONB), `quick_replies`, `created_at`
- **Demand state table**: `demand_states` — columns: `user_id` (PK), `team_id`, `state` (JSONB: `{ client, document }`), `updated_at`
- **Users**: `users` — `id`, `email`, `team_id`

## Process

### 1. Identify the conversation

If the user provides a screenshot, message content, or approximate time, find the relevant messages:

```sql
-- Search by content keywords
SELECT id, role, LEFT(content, 150), created_at
FROM messages
WHERE content ILIKE '%keyword%'
ORDER BY created_at DESC LIMIT 10;
```

If the user provides a user email:
```sql
SELECT id FROM users WHERE email = 'xxx';
```

### 2. Get full conversation timeline

Once you have the `user_id`, get the conversation window around the problem:

```sql
SELECT id, role, LEFT(content, 150) as content,
       tool_calls IS NOT NULL as has_tools,
       rich_card IS NOT NULL as has_card,
       created_at
FROM messages
WHERE user_id = '<user_id>'
  AND created_at BETWEEN '<start>' AND '<end>'
ORDER BY created_at ASC;
```

### 3. Inspect tool calls for each assistant message

For each relevant assistant message, extract the full tool call chain:

```sql
SELECT tool_calls FROM messages WHERE id = '<message_id>';
```

The `tool_calls` JSONB structure is:
```json
[
  [  // round 1
    { "name": "tool_name", "input": {...}, "result": {...}, "toolUseId": "..." }
  ],
  [  // round 2 (if multi-round)
    ...
  ]
]
```

Each round = one Claude API call. Multiple rounds mean the AI called tools, got results, then called more tools.

### 4. Check demand state

```sql
SELECT state FROM demand_states WHERE user_id = '<user_id>';
```

Key fields in `state`:
- `client`: `{ id, name }` — active client (null if none)
- `document`: `{ type, lines[], documentId?, title?, tvaContext? }` — active document
- `document.documentId`: if set, the document was already saved to DB (quote/invoice exists)

### 5. Check debug trace for token usage and timing

```sql
SELECT debug_trace FROM messages WHERE id = '<message_id>';
```

Structure: `{ rounds: [{ inputTokens, outputTokens, costCents, durationMs, toolCalls }], totalTokens, totalCostCents, totalDurationMs }`

### 6. Cross-reference with actual entities

If tool calls created/modified quotes or invoices:
```sql
-- Check invoice state
SELECT id, number, status, total_ttc, created_at FROM invoices WHERE id = '<documentId>';

-- Check quote state
SELECT id, number, status, total_ttc, created_at FROM quotes WHERE id = '<documentId>';
```

## Key things to look for

- **State not reset**: Was `resolve_client` called with `intent: 'new'`? If not, `shouldWipeDocument()` never runs and old document state persists.
- **Wrong tool called**: Did the AI call `add_lines` when it should have called `update_invoice`? Or vice versa?
- **Missing tool call**: Did the AI skip a step (e.g., skipped `resolve_client` because client was already active)?
- **documentId leaking**: After document generation, does the state still carry old `documentId` into new operations?
- **Multi-round confusion**: In round 2+, did the AI misinterpret tool results from round 1?

## Output

1. **Timeline**: Numbered list of user messages and AI actions (tool calls + responses)
2. **State trace**: Show demand state before and after each critical tool call
3. **Root cause**: Identify exactly which step went wrong and why
4. **Code pointer**: Link to the specific tool/handler/orchestrator code responsible
5. **Fix suggestion**: Propose whether the fix belongs in code (handler logic) or tool description
