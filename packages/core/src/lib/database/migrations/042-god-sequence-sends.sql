-- Send history for all sequence sends (email + whatsapp)
CREATE TABLE god_sequence_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES god_prospects(id),
  sequence_id UUID NOT NULL REFERENCES god_sequences(id),
  step_order SMALLINT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_god_sequence_sends_sent ON god_sequence_sends (sent_at DESC);
CREATE INDEX idx_god_sequence_sends_prospect ON god_sequence_sends (prospect_id);
