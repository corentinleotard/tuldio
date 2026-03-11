-- Invoice types: standard, acompte, solde, situation, avoir
ALTER TABLE invoices ADD COLUMN invoice_type VARCHAR(20) NOT NULL DEFAULT 'standard'
  CHECK (invoice_type IN ('standard', 'acompte', 'solde', 'situation', 'avoir'));

-- avoir → original invoice it cancels
ALTER TABLE invoices ADD COLUMN source_invoice_id UUID REFERENCES invoices(id);

-- situation billing: progress number (phase 2)
ALTER TABLE invoices ADD COLUMN situation_number INTEGER;

-- back-reference: original invoice → its credit note
ALTER TABLE invoices ADD COLUMN avoir_id UUID REFERENCES invoices(id);

-- separate numbering sequence for avoirs (AVO-YYYY-NNNN)
ALTER TABLE teams ADD COLUMN avoir_last_number INTEGER NOT NULL DEFAULT 0;
