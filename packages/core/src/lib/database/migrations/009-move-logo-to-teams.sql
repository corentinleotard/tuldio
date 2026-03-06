BEGIN;

-- Add columns to teams
ALTER TABLE teams ADD COLUMN logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE teams ADD COLUMN original_document_url TEXT NOT NULL DEFAULT '';

-- Migrate values from team_fields
UPDATE teams t
SET logo_url = COALESCE((SELECT value FROM team_fields tf WHERE tf.team_id = t.id AND tf.key = 'logo_url'), ''),
    original_document_url = COALESCE((SELECT value FROM team_fields tf WHERE tf.team_id = t.id AND tf.key = 'original_document_url'), '');

-- Delete the field rows
DELETE FROM team_fields WHERE key IN ('logo_url', 'original_document_url');

COMMIT;
