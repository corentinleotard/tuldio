-- Revert capital_social from free text back to numeric (cents)
-- Extracts the number from "au capital de X,YY €" format and converts back to cents
UPDATE team_fields
SET value = (
  REGEXP_REPLACE(
    REGEXP_REPLACE(value, '^au capital de\s*', ''),
    '\s*€\s*$', ''
  )
)
WHERE key = 'capital_social' AND is_system = true AND value LIKE 'au capital de%';

-- Convert "1234,56" back to cents "123456"
UPDATE team_fields
SET value = (
  SPLIT_PART(value, ',', 1)::bigint * 100 +
  COALESCE(NULLIF(SPLIT_PART(value, ',', 2), '')::bigint, 0)
)::text
WHERE key = 'capital_social' AND is_system = true AND value ~ '^\d+,\d{2}$';
