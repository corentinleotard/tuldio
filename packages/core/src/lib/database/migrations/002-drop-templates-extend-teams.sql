-- Drop template_id from quotes and invoices
ALTER TABLE quotes DROP COLUMN template_id;
ALTER TABLE invoices DROP COLUMN template_id;

-- Drop templates table
DROP INDEX IF EXISTS idx_templates_team;
DROP TABLE templates;

-- Extend teams with company data columns
ALTER TABLE teams ADD COLUMN phone VARCHAR(20);
ALTER TABLE teams ADD COLUMN email VARCHAR(255);
ALTER TABLE teams ADD COLUMN mobile VARCHAR(20);
ALTER TABLE teams ADD COLUMN website VARCHAR(255);
ALTER TABLE teams ADD COLUMN logo_url VARCHAR(500);
ALTER TABLE teams ADD COLUMN tva_number VARCHAR(20);
ALTER TABLE teams ADD COLUMN tva_exempt BOOLEAN DEFAULT FALSE;
ALTER TABLE teams ADD COLUMN ape_code VARCHAR(10);
ALTER TABLE teams ADD COLUMN legal_form VARCHAR(50);
ALTER TABLE teams ADD COLUMN capital_social INTEGER;
ALTER TABLE teams ADD COLUMN rcs_city VARCHAR(100);
ALTER TABLE teams ADD COLUMN rm_city VARCHAR(100);
ALTER TABLE teams ADD COLUMN activity_description TEXT;
ALTER TABLE teams ADD COLUMN insurance_company VARCHAR(255);
ALTER TABLE teams ADD COLUMN insurance_policy_number VARCHAR(100);
ALTER TABLE teams ADD COLUMN insurance_coverage_zone VARCHAR(255);
ALTER TABLE teams ADD COLUMN payment_terms TEXT;
ALTER TABLE teams ADD COLUMN deposit_percent INTEGER;
ALTER TABLE teams ADD COLUMN early_payment_discount TEXT;
ALTER TABLE teams ADD COLUMN late_penalty_rate TEXT;
ALTER TABLE teams ADD COLUMN recovery_fee INTEGER DEFAULT 40;
ALTER TABLE teams ADD COLUMN custom_clauses JSONB DEFAULT '[]';
ALTER TABLE teams ADD COLUMN original_document_url VARCHAR(500);
ALTER TABLE teams ADD COLUMN terms_accepted_at TIMESTAMPTZ;

-- Make siret nullable (filled during onboarding, not at signup)
ALTER TABLE teams ALTER COLUMN siret DROP NOT NULL;
