BEGIN;

-- Move activity_description from legal to identity
UPDATE team_fields SET zone = 'identity', sort_order = 9 WHERE key = 'activity_description';

-- Move insurance fields from footer to legal
UPDATE team_fields SET zone = 'legal', sort_order = 3 WHERE key = 'insurance_company';
UPDATE team_fields SET zone = 'legal', sort_order = 4 WHERE key = 'insurance_policy_number';
UPDATE team_fields SET zone = 'legal', sort_order = 5 WHERE key = 'insurance_coverage_zone';

-- Move early_payment_discount, late_penalty_rate, recovery_fee from payment to legal
UPDATE team_fields SET zone = 'legal', sort_order = 0 WHERE key = 'early_payment_discount';
UPDATE team_fields SET zone = 'legal', sort_order = 1 WHERE key = 'late_penalty_rate';
UPDATE team_fields SET zone = 'legal', sort_order = 2 WHERE key = 'recovery_fee';

-- Reorder remaining legal fields (legal_form, capital_social, rcs_city, rm_city, ape_code)
UPDATE team_fields SET sort_order = 6 WHERE key = 'legal_form';
UPDATE team_fields SET sort_order = 7 WHERE key = 'capital_social';
UPDATE team_fields SET sort_order = 8 WHERE key = 'rcs_city';
UPDATE team_fields SET sort_order = 9 WHERE key = 'rm_city';
UPDATE team_fields SET sort_order = 10 WHERE key = 'ape_code';

-- Reorder payment fields (only payment_terms, deposit_percent, iban remain)
UPDATE team_fields SET sort_order = 2 WHERE key = 'iban';

-- Move any custom fields that were in footer zone to legal
UPDATE team_fields SET zone = 'legal' WHERE zone = 'footer';

-- Update the CHECK constraint to remove footer
ALTER TABLE team_fields DROP CONSTRAINT IF EXISTS team_fields_zone_check;
ALTER TABLE team_fields ADD CONSTRAINT team_fields_zone_check CHECK (zone IN ('identity', 'payment', 'legal'));

COMMIT;
