-- Add missing status timestamp columns

-- Invoices: cancelled_at
ALTER TABLE invoices ADD COLUMN cancelled_at TIMESTAMPTZ;

-- Quotes: accepted_at, refused_at, cancelled_at
ALTER TABLE quotes ADD COLUMN accepted_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN refused_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN cancelled_at TIMESTAMPTZ;
