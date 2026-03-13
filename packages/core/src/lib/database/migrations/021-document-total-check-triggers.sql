-- Verify that document total_ht equals the sum of its lines.
-- Uses DEFERRABLE INITIALLY DEFERRED so the check runs at COMMIT time,
-- after both the parent row and all lines have been inserted.
-- This is a safety net — it should never trigger in normal operation.

CREATE OR REPLACE FUNCTION verify_invoice_total_ht() RETURNS TRIGGER AS $$
DECLARE
  lines_sum INTEGER;
BEGIN
  SELECT COALESCE(SUM(total_ht), 0) INTO lines_sum
  FROM invoice_lines
  WHERE invoice_id = NEW.invoice_id;

  IF lines_sum IS DISTINCT FROM (SELECT total_ht FROM invoices WHERE id = NEW.invoice_id) THEN
    RAISE EXCEPTION 'invoice total_ht mismatch: invoices.total_ht != SUM(invoice_lines.total_ht) for invoice %', NEW.invoice_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_verify_invoice_total_ht
  AFTER INSERT ON invoice_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION verify_invoice_total_ht();


CREATE OR REPLACE FUNCTION verify_quote_total_ht() RETURNS TRIGGER AS $$
DECLARE
  lines_sum INTEGER;
BEGIN
  SELECT COALESCE(SUM(total_ht), 0) INTO lines_sum
  FROM quote_lines
  WHERE quote_id = NEW.quote_id;

  IF lines_sum IS DISTINCT FROM (SELECT total_ht FROM quotes WHERE id = NEW.quote_id) THEN
    RAISE EXCEPTION 'quote total_ht mismatch: quotes.total_ht != SUM(quote_lines.total_ht) for quote %', NEW.quote_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_verify_quote_total_ht
  AFTER INSERT ON quote_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION verify_quote_total_ht();
