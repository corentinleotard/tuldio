-- =============================================================================
-- Migration 010: Normalize quote/invoice lines + add prestations catalog
-- =============================================================================

-- 1. Prestations catalog (artisan's service/product referential)
CREATE TABLE prestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('service', 'fourniture')),
  description VARCHAR(500) NOT NULL,
  reference VARCHAR(100),
  unit VARCHAR(20) NOT NULL DEFAULT 'u',
  default_unit_price INTEGER,
  default_tva_rate SMALLINT NOT NULL DEFAULT 2000,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prestations_team ON prestations(team_id);
CREATE INDEX idx_prestations_desc_trgm ON prestations USING gin(description gin_trgm_ops);

-- 2. Add title + valid_until to quotes, add cancelled status
ALTER TABLE quotes ADD COLUMN title VARCHAR(255);
ALTER TABLE quotes ADD COLUMN valid_until DATE;
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'refused', 'cancelled'));

-- 3. Add title + cancelled status to invoices
ALTER TABLE invoices ADD COLUMN title VARCHAR(255);
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'));

-- 4. Quote lines table
CREATE TABLE quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  prestation_id UUID REFERENCES prestations(id),
  sort_order SMALLINT NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'u',
  unit_price INTEGER NOT NULL,
  tva_rate SMALLINT NOT NULL DEFAULT 2000,
  total_ht INTEGER NOT NULL
);

CREATE INDEX idx_quote_lines_quote ON quote_lines(quote_id);

-- 5. Invoice lines table
CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  prestation_id UUID REFERENCES prestations(id),
  sort_order SMALLINT NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'u',
  unit_price INTEGER NOT NULL,
  tva_rate SMALLINT NOT NULL DEFAULT 2000,
  total_ht INTEGER NOT NULL
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- 6. Migrate existing JSONB lines to quote_lines
INSERT INTO quote_lines (quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
SELECT
  q.id,
  (row_number() OVER (PARTITION BY q.id ORDER BY idx))::smallint,
  line->>'description',
  (line->>'quantity')::numeric,
  'u',
  (line->>'unitPrice')::integer,
  q.tva_rate * 100, -- old format was 20 for 20%, new is 2000
  (line->>'total')::integer
FROM quotes q,
  jsonb_array_elements(q.lines) WITH ORDINALITY AS t(line, idx);

-- 7. Migrate existing JSONB lines to invoice_lines
INSERT INTO invoice_lines (invoice_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
SELECT
  i.id,
  (row_number() OVER (PARTITION BY i.id ORDER BY idx))::smallint,
  line->>'description',
  (line->>'quantity')::numeric,
  'u',
  (line->>'unitPrice')::integer,
  i.tva_rate * 100,
  (line->>'total')::integer
FROM invoices i,
  jsonb_array_elements(i.lines) WITH ORDINALITY AS t(line, idx);

-- 8. Drop old JSONB columns and tva_rate
ALTER TABLE quotes DROP COLUMN lines;
ALTER TABLE quotes DROP COLUMN tva_rate;
ALTER TABLE invoices DROP COLUMN lines;
ALTER TABLE invoices DROP COLUMN tva_rate;

-- 9. Drop expenses table (not in v1)
DROP INDEX IF EXISTS idx_expenses_team;
DROP INDEX IF EXISTS idx_expenses_date;
DROP TABLE IF EXISTS expenses;
