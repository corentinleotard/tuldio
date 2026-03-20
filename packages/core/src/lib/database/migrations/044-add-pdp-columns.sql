ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdp_id VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdp_status VARCHAR(50);

-- Extend document_logs event CHECK to include PDP events
ALTER TABLE document_logs DROP CONSTRAINT IF EXISTS document_logs_event_check;
ALTER TABLE document_logs ADD CONSTRAINT document_logs_event_check
  CHECK (event IN ('created', 'status_changed', 'email_sent', 'downloaded', 'viewed', 'signed', 'pdp_submitted', 'pdp_status_changed', 'pdp_payment_reported'));
