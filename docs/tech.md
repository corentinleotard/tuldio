# Tuldio — Technical Architecture

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + Vite + shadcn/ui + Tailwind | One codebase for web + mobile, fast DX, great component library |
| Mobile | Capacitor | Wraps the web app in native shell for App Store / Play Store |
| API | Express (Node.js) | Battle-tested, simple, team knows it |
| Database | PostgreSQL (raw pg + Zod) | Raw SQL for performance, AI generates queries directly, pgvector ready for V2 |
| AI | Claude API (Anthropic) | Best vision model for OCR, best at French, structured tool use |
| Auth | Custom email OTP (Resend) | No vendor lock-in, no SMS cost, 3k emails/month free |
| Payments | Stripe | Standard, handles subscriptions + trials |
| Storage | Local disk (V1) → S3 when needed | Zero config, fast, simple backup via rsync/VPS snapshot |
| Hosting (API) | OVH / Scaleway | French servers, RGPD compliant |
| Hosting (DB) | OVH Managed PostgreSQL | Backups, pgvector included, ~15€/month |
| PDF | React-PDF (@react-pdf/renderer) | Lightweight, real text output, no headless Chrome needed |
| i18n | i18next + react-i18next | French-first, keys ready for future languages |
| Crons | node-cron | Monthly summaries, payment reminders, trial expiry |

## Monorepo Structure

```
apps/
  api/src/
    routes/           # Express route definitions
    controllers/      # Request handlers (1 file = 1 handler)
    middleware/        # Auth, error handling, validation
    index.ts          # Server entry point
  web/src/
    pages/            # Chat, Documents, Clients, Stats, Settings
    modules/          # Feature modules (chat/, documents/, clients/, stats/, settings/)
    components/       # Shared components
    components/ui/    # shadcn/ui components
    lib/              # API client, i18n setup, utils
    i18n/
      fr.json         # French translations (only language for now)
  crons/src/
    jobs/             # 1 file = 1 cron job
    lib/schedule.ts   # Cron wrapper with error handling
    index.ts          # Entry point
packages/
  core/src/
    modules/
      clients/        # domain/ repository/ use-cases/
      quotes/         # domain/ repository/ use-cases/
      invoices/       # domain/ repository/ use-cases/
      expenses/       # domain/ repository/ use-cases/
      templates/      # domain/ repository/ use-cases/
    lib/
      database/       # raw pg schema, connection, migrations
      errors/         # HandledError, error codes
      infra/          # Logger, ID generation
      ai/             # Claude client, chat orchestration, template extraction
      pdf/            # React-PDF document builders
      storage/        # Local disk file storage (migrate to S3 later)
  types/src/          # Shared API contract types
```

## Key Technical Flows

### 1. Template Upload
```
User takes photo/uploads PDF
  → API receives file → stores original on disk
  → Claude Vision analyzes document:
    - Extracts layout structure (header, client zone, line items, footer)
    - Identifies logo position and dimensions
    - Reads legal mentions, company info
    - Detects line item format (columns, alignment)
  → Structured template stored in PostgreSQL
  → Confirmation sent to user with preview
```

### 2. Quote/Invoice Generation
```
User: "Devis pour Martin Jean, 25m² parquet 50€/m²"
  → Claude parses intent + extracts:
    { type: "quote", client: "Martin Jean", lines: [{ desc: "Parquet", qty: 25, unit: "m²", price: 50 }] }
  → Look up or create client "Martin Jean"
  → Look up user's quote template
  → React-PDF generates document using template layout + line data
  → PDF stored on disk
  → Record saved in PostgreSQL (quote with lines, total, status)
  → Response: rich card with PDF preview + "Envoyer à Martin Jean ?"
```

### 3. Chat Orchestration
```
User message arrives
  → Claude receives: system prompt + user's business context + conversation history
  → Claude decides action via tool use:
    - generate_quote(client, lines)
    - generate_invoice(client, lines, quote_id?)
    - mark_as_paid(invoice_id)
    - record_expense(amount, vendor, category, receipt_url)
    - search_clients(query)
    - get_stats(period, metric)
    - add_client_note(client_id, note)
    - send_document(document_id, method: email|sms)
  → Tool executes → result returned to Claude → natural language response to user
```

### 4. Expense Capture
```
User takes photo of receipt
  → Image sent to API → stored on disk
  → Claude Vision extracts: amount, vendor, date, category
  → Confirmation: "Facture Métro, 234€, fournitures, 12 mars. C'est bon ?"
  → User confirms → saved to PostgreSQL
```

### 5. Stats Query
```
User: "Combien ce mois-ci ?"
  → Claude calls get_stats({ period: "current_month", metrics: ["revenue", "expenses", "result"] })
  → SQL queries on quotes/invoices/expenses tables
  → Returns: { revenue: 4850, expenses: 2100, result: 2750 }
  → Claude formats: "En février tu as encaissé 4 850€, dépensé 2 100€, résultat +2 750€."
```

## Database Schema (raw SQL + Zod)

```sql
CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,  -- 10 minutes
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,              -- business name (e.g. "Durand Plomberie")
  siret VARCHAR(14) UNIQUE NOT NULL,
  address TEXT,
  stripe_customer_id VARCHAR(255),
  trial_ends_at TIMESTAMPTZ,
  subscription_status VARCHAR(20) DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_team ON users(team_id);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,  -- 90 days
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- Business data: all scoped by team_id
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('quote', 'invoice')),
  layout_data JSONB NOT NULL,       -- extracted template structure
  original_url VARCHAR(500) NOT NULL, -- file path of uploaded file
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  notes JSONB DEFAULT '[]',         -- [{ text, date, added_by }]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,  -- who created this quote
  client_id UUID REFERENCES clients(id) NOT NULL,
  template_id UUID REFERENCES templates(id) NOT NULL,
  number VARCHAR(50) NOT NULL,      -- sequential: DEVIS-2025-001
  lines JSONB NOT NULL,             -- [{ description, quantity, unit, unit_price, total }]
  total_ht INTEGER NOT NULL,        -- cents
  total_ttc INTEGER NOT NULL,       -- cents
  tva_rate INTEGER NOT NULL,        -- basis points (2000 = 20%)
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'refused')),
  pdf_url VARCHAR(500),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, number)
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  quote_id UUID REFERENCES quotes(id),
  template_id UUID REFERENCES templates(id) NOT NULL,
  number VARCHAR(50) NOT NULL,      -- sequential: FAC-2025-001
  lines JSONB NOT NULL,
  total_ht INTEGER NOT NULL,
  total_ttc INTEGER NOT NULL,
  tva_rate INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  pdf_url VARCHAR(500),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, number)
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) NOT NULL,
  created_by UUID REFERENCES users(id) NOT NULL,
  amount INTEGER NOT NULL,          -- cents
  category VARCHAR(100),
  vendor VARCHAR(255),
  receipt_url VARCHAR(500),
  date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages: scoped by user (each user has their own chat)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  team_id UUID REFERENCES teams(id) NOT NULL,   -- denormalized for query efficiency
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',   -- [{ type: 'image'|'pdf', url, thumbnail_url? }]
  tool_calls JSONB,                 -- [{ name, input, result }] — only for assistant messages
  rich_card JSONB,                  -- { type: 'quote'|'invoice'|'stats'|'expense', data } — rendered inline
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_templates_team ON templates(team_id);
CREATE INDEX idx_clients_team ON clients(team_id);
CREATE INDEX idx_clients_name_trgm ON clients USING gin(name gin_trgm_ops);
CREATE INDEX idx_quotes_team ON quotes(team_id);
CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_invoices_team ON invoices(team_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(team_id, status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status = 'sent';
CREATE INDEX idx_expenses_team ON expenses(team_id);
CREATE INDEX idx_expenses_date ON expenses(team_id, date);
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- fuzzy text matching
```

## Data Quality

Data quality is the #1 priority in this project. Bad data = bad stats = lost trust = churn.

### The 3 Modes Rule

Every AI action that touches data:
1. **Confident** (exact match) → act, confirm after
2. **Unsure** (fuzzy/multiple) → ask before acting
3. **Unknown** (no match) → propose creation

**Never silently create a duplicate. Never silently pick the wrong match.**

### Fuzzy Matching

PostgreSQL `pg_trgm` extension handles typos, reversed names, partial matches:
- "jean martin" matches "Martin Jean"
- "Martin" matches "Martin Jean" and "Martin Jean-Pierre" → asks user to pick
- Exact phone/email match → same client, no ambiguity

### Dedup by Entity

| Entity | Strategy |
|--------|----------|
| Clients | Fuzzy name match + exact phone/email. Multiple matches → ask user. |
| Expenses | Same vendor + amount + date (±1 day) → flag as potential duplicate. |
| Quote lines | Fuzzy description match → suggest past pricing, always confirm. |
| Invoice numbers | Sequential, gapless, `SELECT MAX() FOR UPDATE` to prevent gaps. |

### OCR Confirmation

All data extracted from photos (receipts, templates) is confirmed with the user before storing. Critical fields (amounts, vendor names) are never assumed correct.

## AI Architecture

### Chat Persistence

The user sees one continuous conversation — like WhatsApp, never resets.

```
Storage:
  → Each message is a row in the messages table (user_id, role, content, created_at)
  → Rich content (quote cards, stats, expense confirmations) stored in rich_card JSONB
  → Attachments (photos, PDFs) stored in attachments JSONB with file URLs
  → Tool calls and results stored in tool_calls JSONB (assistant messages only)

Frontend:
  → On open: load last 30 messages (SELECT ... ORDER BY created_at DESC LIMIT 30)
  → Scroll up: paginate older messages (cursor-based, 30 per page)
  → New messages appended in real-time

What we send to Claude per request:
  → System prompt (business context, available tools, pricing memory)
  → Last 20-30 messages only (recent conversational context)
  → Claude does NOT need old messages to access data
    — it uses tools (get_stats, find_client, etc.) that query the DB directly
```

### System Prompt
The Claude system prompt includes:
- User's business context (name, business type, SIRET)
- Available tools (generate_quote, get_stats, etc.)
- Pricing memory (learned from past quotes/invoices)
- Tone instructions (friendly, tu-form, plain French)
- Current date for relative time queries

### Tool Use
Claude uses structured tool calling — not free-form text parsing:
- Each business action is a defined tool with typed parameters
- Claude decides which tool to call based on user intent
- Tools execute against the database and return structured results
- Claude formats results into natural French responses

### Pricing Memory
- After each quote/invoice, line items + prices are indexed
- When user creates a new quote, Claude suggests prices based on history
- "Tu as facturé 62€/m² pour du carrelage la dernière fois. Je pars là-dessus ?"
- User can override — the new price becomes the latest reference

## Security

- **Auth**: custom email OTP → access token (15min) + refresh token (90 days)
- **Token storage**: `localStorage` on web, Capacitor Preferences plugin on mobile (Keychain on iOS, Keystore on Android via Capacitor)
- **Silent refresh**: app auto-refreshes access token via refresh token — active users never re-login
- **Data isolation**: all queries filtered by teamId (or userId for messages) — enforced at repository layer
- **Hosting**: OVH France (Paris/Strasbourg) — data never leaves France
- **Storage**: local disk, VPS encrypted at rest, HTTPS in transit
- **API keys**: environment variables, never in code
- **RGPD**: clear privacy policy, data export on request, account deletion deletes everything
- **CGU clause**: "L'utilisateur est responsable de la conformité de ses modèles de documents"

## V2 Technical Additions

- **pgvector**: add embeddings column to documents for RAG search across all content
- **Bridge API / Powens**: bank sync for auto-matching payments to invoices
- **Chart generation**: Recharts components rendered in-app from stats queries
- **FEC export**: structured accounting export format for accountants
- **WebSocket**: real-time chat updates (currently polling or push notification)
- **Capacitor plugins**: native camera, push notifications, haptic feedback
