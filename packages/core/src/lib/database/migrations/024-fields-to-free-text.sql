-- Convert recovery_fee from numeric (cents) to free text
-- Only converts values that are purely digits (existing numeric format)
UPDATE team_fields
SET value = 'Indemnité forfaitaire de recouvrement : ' ||
  (value::bigint / 100)::text || ',' || LPAD((ABS(value::bigint) % 100)::text, 2, '0') || ' €'
WHERE key = 'recovery_fee' AND is_system = true AND value ~ '^\d+$';

-- Scope payment_terms to quote only
UPDATE team_fields SET scope = 'quote', show_invoice = false
WHERE key = 'payment_terms' AND is_system = true;

-- Remove deposit_percent field
DELETE FROM team_fields WHERE key = 'deposit_percent' AND is_system = true;
