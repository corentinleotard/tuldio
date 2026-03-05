# Data Quality — Core Principle

Data quality is the #1 priority. Bad data = bad stats = lost trust = churned user.
The AI must behave like a careful assistant: **never guess silently, always confirm ambiguity.**

## The 3 Modes Rule

Every AI action that touches data falls into exactly one mode:

1. **Confident** (exact match, high score) → act, confirm after: "Devis créé pour Martin Jean."
2. **Unsure** (fuzzy/multiple matches) → ask before acting: "C'est lequel ?"
3. **Unknown** (no match) → propose: "Je ne le connais pas. Je le crée ?"

**Never silently create a duplicate. Never silently pick the wrong match.**

## Client Deduplication

- Fuzzy match on name using `pg_trgm` (trigram similarity)
- If phone or email matches exactly → same client, no question asked
- Multiple matches → list them with context (address, last interaction) and ask user to pick
- Reversed names, typos, partial names must be handled: "jean martin" = "Martin Jean"

```sql
-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fuzzy search query pattern
SELECT *, similarity(name, $1) as score
FROM clients
WHERE team_id = $2
  AND (
    name ILIKE '%' || $1 || '%'
    OR similarity(name, $1) > 0.3
  )
ORDER BY score DESC
LIMIT 5;
```

## Expense Deduplication

- Same vendor + same amount + same date (± 1 day) → "Tu as déjà enregistré cette dépense. Doublon ?"
- Same receipt photo hash → block duplicate silently

## Quote/Invoice Line Matching

- Fuzzy match on line description to suggest past pricing
- "carrelage" ≈ "pose carrelage" ≈ "carrelage sol" → suggest last known price
- Always confirm suggested prices: "La dernière fois c'était 62€/m². Je pars là-dessus ?"

## OCR Confidence

- When extracting data from photos (receipts, templates), always confirm uncertain fields
- "J'ai lu 847€, c'est correct ?" — never assume OCR is perfect
- If multiple fields are uncertain, confirm the most important ones (amount, vendor)

## General Rules

- **No silent inserts** — every new entity creation is either explicitly requested or confirmed
- **No silent updates** — changing a client's phone/email/address requires confirmation
- **No silent deletes** — always ask before removing anything
- **Amounts are critical** — always confirm amounts on quotes/invoices before generating PDF
- **Sequential numbering** — quote/invoice numbers must be gapless and sequential per user. Use `SELECT MAX(number) ... FOR UPDATE` to prevent race conditions
