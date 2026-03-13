-- Fix: ROUND() in PostgreSQL rounds away from zero for .5, but JS Math.round()
-- rounds toward +Infinity. For negative amounts (avoirs/credit notes), this can
-- cause a 1-cent difference, making the trigger reject valid inserts.
-- Fix: use FLOOR(x + 0.5) which matches JS Math.round() behavior for all values.

CREATE OR REPLACE FUNCTION verify_invoice_totals() RETURNS TRIGGER AS $$
DECLARE
  expected_ht  INTEGER;
  expected_ttc INTEGER;
  actual_ht    INTEGER;
  actual_ttc   INTEGER;
BEGIN
  SELECT COALESCE(SUM(total_ht), 0),
         COALESCE(SUM(total_ht + FLOOR(total_ht * tva_rate / 10000.0 + 0.5)::INTEGER), 0)
    INTO expected_ht, expected_ttc
    FROM (
      SELECT tva_rate, SUM(total_ht) AS total_ht
      FROM invoice_lines
      WHERE invoice_id = NEW.invoice_id
      GROUP BY tva_rate
    ) groups;

  SELECT total_ht, total_ttc INTO actual_ht, actual_ttc
  FROM invoices WHERE id = NEW.invoice_id;

  IF expected_ht IS DISTINCT FROM actual_ht THEN
    RAISE EXCEPTION 'invoice total_ht mismatch: expected % (sum of lines), got % for invoice %',
      expected_ht, actual_ht, NEW.invoice_id;
  END IF;

  IF expected_ttc IS DISTINCT FROM actual_ttc THEN
    RAISE EXCEPTION 'invoice total_ttc mismatch: expected % (lines + TVA), got % for invoice %',
      expected_ttc, actual_ttc, NEW.invoice_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION verify_quote_totals() RETURNS TRIGGER AS $$
DECLARE
  expected_ht  INTEGER;
  expected_ttc INTEGER;
  actual_ht    INTEGER;
  actual_ttc   INTEGER;
BEGIN
  SELECT COALESCE(SUM(total_ht), 0),
         COALESCE(SUM(total_ht + FLOOR(total_ht * tva_rate / 10000.0 + 0.5)::INTEGER), 0)
    INTO expected_ht, expected_ttc
    FROM (
      SELECT tva_rate, SUM(total_ht) AS total_ht
      FROM quote_lines
      WHERE quote_id = NEW.quote_id
      GROUP BY tva_rate
    ) groups;

  SELECT total_ht, total_ttc INTO actual_ht, actual_ttc
  FROM quotes WHERE id = NEW.quote_id;

  IF expected_ht IS DISTINCT FROM actual_ht THEN
    RAISE EXCEPTION 'quote total_ht mismatch: expected % (sum of lines), got % for quote %',
      expected_ht, actual_ht, NEW.quote_id;
  END IF;

  IF expected_ttc IS DISTINCT FROM actual_ttc THEN
    RAISE EXCEPTION 'quote total_ttc mismatch: expected % (lines + TVA), got % for quote %',
      expected_ttc, actual_ttc, NEW.quote_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
