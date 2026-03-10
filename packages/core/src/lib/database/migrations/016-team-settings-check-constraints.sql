ALTER TABLE teams ADD CONSTRAINT chk_quote_last_number CHECK (quote_last_number >= 0);
ALTER TABLE teams ADD CONSTRAINT chk_quote_validity_days CHECK (quote_validity_days >= 1);
ALTER TABLE teams ADD CONSTRAINT chk_invoice_last_number CHECK (invoice_last_number >= 0);
