-- Split name into first_name + last_name
ALTER TABLE clients ADD COLUMN first_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN last_name VARCHAR(255);

-- Migrate existing data: split on first space
UPDATE clients SET
  first_name = CASE
    WHEN position(' ' in name) > 0 THEN left(name, position(' ' in name) - 1)
    ELSE name
  END,
  last_name = CASE
    WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END;

-- Make NOT NULL after migration
ALTER TABLE clients ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE clients ALTER COLUMN last_name SET NOT NULL;

-- Drop old column
ALTER TABLE clients DROP COLUMN name;

-- Unique constraints on email and phone (per team, partial - only when not null)
CREATE UNIQUE INDEX idx_clients_team_email ON clients(team_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_clients_team_phone ON clients(team_id, phone) WHERE phone IS NOT NULL;

-- Trigram indexes for fuzzy search on first_name and last_name
CREATE INDEX idx_clients_first_name_trgm ON clients USING gin(first_name gin_trgm_ops);
CREATE INDEX idx_clients_last_name_trgm ON clients USING gin(last_name gin_trgm_ops);

-- Drop old trigram index on name
DROP INDEX IF EXISTS idx_clients_name_trgm;
