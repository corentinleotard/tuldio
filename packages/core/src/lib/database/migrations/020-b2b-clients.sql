-- B2B client support: add company fields, make first/last name nullable
ALTER TABLE clients
  ADD COLUMN company_name VARCHAR(255),
  ADD COLUMN siret VARCHAR(14),
  ADD COLUMN tva_number VARCHAR(20);

-- Make first_name/last_name nullable (contact person for B2B, can be empty)
ALTER TABLE clients ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE clients ALTER COLUMN last_name DROP NOT NULL;

-- SIRET unique per team (only for non-null values)
CREATE UNIQUE INDEX idx_clients_team_siret ON clients(team_id, siret) WHERE siret IS NOT NULL;

-- Trigram index on company_name for fuzzy search
CREATE INDEX idx_clients_company_name_trgm ON clients USING gin(company_name gin_trgm_ops);
