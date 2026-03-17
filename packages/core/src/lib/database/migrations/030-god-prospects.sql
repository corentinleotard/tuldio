-- God prospection: move from Excel/JSON files to PostgreSQL

CREATE TABLE god_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profession TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'rpps',  -- rpps, sfdo, web, annuaire_entreprises
  status TEXT NOT NULL DEFAULT 'new',   -- new, sent, error
  sent_at TIMESTAMPTZ,
  scraped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT god_prospects_status_check CHECK (status IN ('new', 'sent', 'error'))
);

CREATE INDEX idx_god_prospects_status ON god_prospects (status);
CREATE INDEX idx_god_prospects_profession ON god_prospects (profession);
CREATE INDEX idx_god_prospects_email ON god_prospects (lower(email));

-- Daily send log (replaces data/send-log.json)
CREATE TABLE god_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT god_send_log_date_unique UNIQUE (sent_date)
);
