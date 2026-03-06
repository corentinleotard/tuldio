CREATE TABLE ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  user_id UUID REFERENCES users(id),
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cents NUMERIC(10, 4) NOT NULL DEFAULT 0,
  prompt_text TEXT,
  response_text TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_calls_team_id ON ai_calls(team_id);
CREATE INDEX idx_ai_calls_created_at ON ai_calls(created_at);
