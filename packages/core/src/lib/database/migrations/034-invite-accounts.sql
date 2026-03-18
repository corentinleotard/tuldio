-- Make users.email nullable (token-created users don't have email initially)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Replace unique constraint with partial unique index (null emails don't conflict)
-- Must drop constraint first, then recreate as partial index
DO $$
BEGIN
  -- Try dropping as constraint first (it may be named differently)
  BEGIN
    ALTER TABLE users DROP CONSTRAINT users_email_key;
  EXCEPTION WHEN undefined_object THEN
    -- Try as index
    DROP INDEX IF EXISTS users_email_key;
  END;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL;

-- Create invite_accounts table (maps invite token hash -> user account)
CREATE TABLE IF NOT EXISTS invite_accounts (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS invite_accounts_user_id ON invite_accounts(user_id);
