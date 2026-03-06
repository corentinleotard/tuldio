-- Migration 006: Create team_fields table and migrate data from teams columns

CREATE TABLE team_fields (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,
  label         TEXT NOT NULL,
  value         TEXT NOT NULL DEFAULT '',
  zone          TEXT NOT NULL CHECK (zone IN ('identity', 'legal', 'payment', 'footer')),
  show_quote    BOOLEAN NOT NULL DEFAULT true,
  show_invoice  BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  is_system     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(team_id, key)
);

CREATE INDEX idx_team_fields_team_id ON team_fields(team_id);

-- Migrate existing data from teams columns into team_fields rows
-- For each existing team, insert system fields with their current values

INSERT INTO team_fields (id, team_id, key, label, value, zone, show_quote, show_invoice, sort_order, is_system)
SELECT
  gen_random_uuid(), t.id, f.key, f.label, COALESCE(f.value, ''), f.zone, f.show_quote, f.show_invoice, f.sort_order, true
FROM teams t
CROSS JOIN LATERAL (VALUES
  ('siret',                    'SIRET',                        t.siret,                              'identity', true,  true,  0),
  ('address',                  'Adresse',                      t.address,                            'identity', true,  true,  1),
  ('phone',                    'Telephone',                    t.phone,                              'identity', true,  true,  2),
  ('mobile',                   'Mobile',                       t.mobile,                             'identity', true,  true,  3),
  ('email',                    'Email',                        t.email,                              'identity', true,  true,  4),
  ('website',                  'Site web',                     t.website,                            'identity', true,  true,  5),
  ('logo_url',                 'Logo',                         t.logo_url,                           'identity', true,  true,  6),
  ('tva_number',               'N TVA',                        t.tva_number,                         'identity', true,  true,  7),
  ('tva_exempt',               'Exonere de TVA',               CASE WHEN t.tva_exempt THEN 'true' ELSE '' END, 'identity', true, true, 8),
  ('ape_code',                 'Code APE',                     t.ape_code,                           'legal',    true,  true,  0),
  ('legal_form',               'Forme juridique',              t.legal_form,                         'legal',    true,  true,  1),
  ('capital_social',           'Capital social',               CASE WHEN t.capital_social IS NOT NULL THEN t.capital_social::text ELSE NULL END, 'legal', true, true, 2),
  ('rcs_city',                 'Ville RCS',                    t.rcs_city,                           'legal',    true,  true,  3),
  ('rm_city',                  'Ville RM',                     t.rm_city,                            'legal',    true,  true,  4),
  ('activity_description',     'Activite',                     t.activity_description,               'legal',    false, false, 5),
  ('insurance_company',        'Assurance',                    t.insurance_company,                  'footer',   true,  true,  0),
  ('insurance_policy_number',  'N police assurance',           t.insurance_policy_number,            'footer',   true,  true,  1),
  ('insurance_coverage_zone',  'Zone couverture assurance',    t.insurance_coverage_zone,            'footer',   true,  true,  2),
  ('payment_terms',            'Conditions de paiement',       t.payment_terms,                      'payment',  true,  true,  0),
  ('deposit_percent',          'Acompte (%)',                  CASE WHEN t.deposit_percent IS NOT NULL THEN t.deposit_percent::text ELSE NULL END, 'payment', true, false, 1),
  ('early_payment_discount',   'Escompte',                     t.early_payment_discount,             'payment',  true,  true,  2),
  ('late_penalty_rate',        'Penalites de retard',          t.late_penalty_rate,                  'payment',  true,  true,  3),
  ('recovery_fee',             'Indemnite de recouvrement',    CASE WHEN t.recovery_fee IS NOT NULL THEN t.recovery_fee::text ELSE NULL END, 'payment', true, true, 4),
  ('iban',                     'IBAN',                         NULL,                                 'payment',  false, true,  5)
) AS f(key, label, value, zone, show_quote, show_invoice, sort_order);

-- Migrate custom_clauses as individual custom fields in footer zone
-- Each clause becomes a separate team_field row
INSERT INTO team_fields (id, team_id, key, label, value, zone, show_quote, show_invoice, sort_order, is_system)
SELECT
  gen_random_uuid(),
  t.id,
  'custom_clause_' || idx,
  'Clause personnalisee ' || idx,
  clause.value,
  'footer',
  true,
  true,
  10 + idx,
  false
FROM teams t,
LATERAL jsonb_array_elements_text(t.custom_clauses::jsonb) WITH ORDINALITY AS clause(value, idx)
WHERE t.custom_clauses IS NOT NULL AND t.custom_clauses != '[]';

-- Also store original_document_url as a hidden system field
INSERT INTO team_fields (id, team_id, key, label, value, zone, show_quote, show_invoice, sort_order, is_system)
SELECT
  gen_random_uuid(), t.id, 'original_document_url', 'Document original', COALESCE(t.original_document_url, ''), 'identity', false, false, 99, true
FROM teams t;

-- Drop migrated columns from teams
ALTER TABLE teams DROP COLUMN IF EXISTS siret;
ALTER TABLE teams DROP COLUMN IF EXISTS address;
ALTER TABLE teams DROP COLUMN IF EXISTS phone;
ALTER TABLE teams DROP COLUMN IF EXISTS email;
ALTER TABLE teams DROP COLUMN IF EXISTS mobile;
ALTER TABLE teams DROP COLUMN IF EXISTS website;
ALTER TABLE teams DROP COLUMN IF EXISTS logo_url;
ALTER TABLE teams DROP COLUMN IF EXISTS tva_number;
ALTER TABLE teams DROP COLUMN IF EXISTS tva_exempt;
ALTER TABLE teams DROP COLUMN IF EXISTS ape_code;
ALTER TABLE teams DROP COLUMN IF EXISTS legal_form;
ALTER TABLE teams DROP COLUMN IF EXISTS capital_social;
ALTER TABLE teams DROP COLUMN IF EXISTS rcs_city;
ALTER TABLE teams DROP COLUMN IF EXISTS rm_city;
ALTER TABLE teams DROP COLUMN IF EXISTS activity_description;
ALTER TABLE teams DROP COLUMN IF EXISTS insurance_company;
ALTER TABLE teams DROP COLUMN IF EXISTS insurance_policy_number;
ALTER TABLE teams DROP COLUMN IF EXISTS insurance_coverage_zone;
ALTER TABLE teams DROP COLUMN IF EXISTS payment_terms;
ALTER TABLE teams DROP COLUMN IF EXISTS deposit_percent;
ALTER TABLE teams DROP COLUMN IF EXISTS early_payment_discount;
ALTER TABLE teams DROP COLUMN IF EXISTS late_penalty_rate;
ALTER TABLE teams DROP COLUMN IF EXISTS recovery_fee;
ALTER TABLE teams DROP COLUMN IF EXISTS custom_clauses;
ALTER TABLE teams DROP COLUMN IF EXISTS original_document_url;
