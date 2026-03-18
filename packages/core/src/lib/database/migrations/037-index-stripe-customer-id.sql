CREATE UNIQUE INDEX IF NOT EXISTS teams_stripe_customer_id_idx ON teams (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
