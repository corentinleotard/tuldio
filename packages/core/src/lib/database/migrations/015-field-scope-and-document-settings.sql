-- 1. Add scope to team_fields (which document type does this field belong to)
ALTER TABLE team_fields ADD COLUMN scope TEXT NOT NULL DEFAULT 'both'
  CHECK (scope IN ('both', 'quote', 'invoice'));

-- 2. Set scope for existing system fields that are document-specific
UPDATE team_fields SET scope = 'quote' WHERE key = 'deposit_percent';
UPDATE team_fields SET scope = 'invoice' WHERE key IN ('iban', 'early_payment_discount', 'late_penalty_rate', 'recovery_fee');

-- 3. Team-level document settings
ALTER TABLE teams
  ADD COLUMN quote_last_number INT NOT NULL DEFAULT 0,
  ADD COLUMN quote_validity_days INT NOT NULL DEFAULT 30,
  ADD COLUMN invoice_last_number INT NOT NULL DEFAULT 0;

-- 4. Per-invoice prestation date
ALTER TABLE invoices ADD COLUMN prestation_date DATE;
