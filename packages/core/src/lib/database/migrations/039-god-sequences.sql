-- Received messages from all channels
CREATE TABLE god_received_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  sender TEXT NOT NULL,
  sender_name TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_god_received_messages_created ON god_received_messages (created_at DESC);

-- Prospection settings & watermarks (e.g. last checked IMAP UID)
CREATE TABLE IF NOT EXISTS god_prospection_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Sequence templates
CREATE TABLE god_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ordered steps in a sequence
CREATE TABLE god_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES god_sequences(id) ON DELETE CASCADE,
  step_order SMALLINT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  delay_days SMALLINT NOT NULL DEFAULT 0,
  subject TEXT,
  body TEXT NOT NULL,
  UNIQUE (sequence_id, step_order)
);

-- Per-channel daily limits
CREATE TABLE god_channel_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL UNIQUE,
  daily_limit INTEGER NOT NULL DEFAULT 2
);

INSERT INTO god_channel_limits (channel, daily_limit) VALUES
  ('email', 10),
  ('whatsapp', 2);

-- Add sequence tracking to prospects
ALTER TABLE god_prospects
  ADD COLUMN sequence_id UUID REFERENCES god_sequences(id),
  ADD COLUMN current_step SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN next_step_at TIMESTAMPTZ,
  ADD COLUMN sequence_status TEXT CHECK (sequence_status IN ('active', 'completed', 'replied', 'paused', 'error')),
  ADD COLUMN whatsapp_phone TEXT;

CREATE INDEX idx_god_prospects_next_step
  ON god_prospects (next_step_at)
  WHERE sequence_status = 'active';

-- Add channel to send log, change unique constraint
ALTER TABLE god_send_log
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'email';

ALTER TABLE god_send_log
  DROP CONSTRAINT god_send_log_date_unique;

ALTER TABLE god_send_log
  ADD CONSTRAINT god_send_log_date_channel_unique UNIQUE (sent_date, channel);

-- Migrate existing prospects into a 2-step sequence: email day 0 + whatsapp day 2
-- Prospects who contacted us via form are excluded (they reached out, no outbound needed)
DO $$
DECLARE
  seq_id UUID := gen_random_uuid();
BEGIN
  -- Create default 2-step sequence
  INSERT INTO god_sequences (id, name, is_active)
  VALUES (seq_id, 'Email + WhatsApp', true);

  -- Step 0: email (day 0)
  INSERT INTO god_sequence_steps (id, sequence_id, step_order, channel, delay_days, subject, body)
  VALUES (
    gen_random_uuid(),
    seq_id,
    0,
    'email',
    0,
    'Vos devis et factures, vous les faites comment ?',
    E'Bonjour {{firstName}},\n\nJe contacte quelques {{professionPlural}} pour leur poser une question : vous faites vos devis comment aujourd''hui ? Word, Excel, papier ?\n\nJ''ai cree un outil qui permet de faire un devis en 30 sec depuis le telephone, juste en envoyant un message ou un vocal.\n\nSi ca vous parle, votre espace est deja pret :\n\nCorentin'
  );

  -- Step 1: whatsapp follow-up (day 2)
  INSERT INTO god_sequence_steps (id, sequence_id, step_order, channel, delay_days, subject, body)
  VALUES (
    gen_random_uuid(),
    seq_id,
    1,
    'whatsapp',
    2,
    NULL,
    E'Bonjour {{firstName}}, je vous ai envoye un email il y a quelques jours.\n\nJ''ai cree un outil pour les {{professionPlural}} : devis en 30 sec depuis le telephone, juste en envoyant un message.\n\nVotre espace est pret si ca vous interesse !'
  );

  -- Already-emailed prospects WITH a valid mobile: set to step 1 (waiting for WhatsApp)
  -- next_step_at = now + 2 days (the WhatsApp step delay)
  UPDATE god_prospects
  SET sequence_id = seq_id,
      current_step = 1,
      sequence_status = 'active',
      next_step_at = now() + INTERVAL '2 days'
  WHERE status = 'sent'
    AND sequence_id IS NULL
    AND contacted_via IS DISTINCT FROM 'form'
    AND COALESCE(phone, '') ~ '^(\+33[67]|0[67])';

  -- Already-emailed prospects WITHOUT a valid mobile: completed (can't do WhatsApp)
  UPDATE god_prospects
  SET sequence_id = seq_id,
      current_step = 1,
      sequence_status = 'completed'
  WHERE status = 'sent'
    AND sequence_id IS NULL
    AND contacted_via IS DISTINCT FROM 'form'
    AND NOT (COALESCE(phone, '') ~ '^(\+33[67]|0[67])');

  -- Error prospects: keep as error
  UPDATE god_prospects
  SET sequence_id = seq_id,
      current_step = 0,
      sequence_status = 'error'
  WHERE status = 'error'
    AND sequence_id IS NULL
    AND contacted_via IS DISTINCT FROM 'form';

  -- Form-contacted prospects: leave unassigned (they came to us)
END $$;
