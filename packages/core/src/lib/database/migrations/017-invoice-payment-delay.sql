ALTER TABLE teams ADD COLUMN invoice_payment_delay_days INT NOT NULL DEFAULT 30;
ALTER TABLE teams ADD CONSTRAINT chk_invoice_payment_delay_days CHECK (invoice_payment_delay_days >= 1);
