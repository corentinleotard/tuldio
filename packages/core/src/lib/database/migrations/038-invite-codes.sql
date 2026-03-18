-- Short invite codes for prospection emails (replaces long JWT in URLs)
-- Code → invite payload JSON, looked up when prospect clicks the link

CREATE TABLE invite_codes (
  code TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_codes_expires ON invite_codes (expires_at);
