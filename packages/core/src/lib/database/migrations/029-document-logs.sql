CREATE TABLE document_logs (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('quote', 'invoice')),
  document_id UUID NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('created', 'status_changed', 'email_sent', 'downloaded', 'viewed', 'signed')),
  recipient_email TEXT,
  download_token TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_logs_document ON document_logs (document_type, document_id);
CREATE UNIQUE INDEX idx_document_logs_download_token ON document_logs (download_token) WHERE download_token IS NOT NULL;
