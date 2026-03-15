ALTER TABLE teams
  ADD COLUMN stripe_subscription_id TEXT,
  ADD COLUMN subscription_period_start TIMESTAMPTZ,
  ADD COLUMN subscription_period_end TIMESTAMPTZ,
  ADD COLUMN ai_cost_limit_cents INTEGER NOT NULL DEFAULT 500;
