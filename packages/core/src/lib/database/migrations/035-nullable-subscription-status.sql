-- subscription_status can be null (no trial started yet — trial starts on first message)
ALTER TABLE teams ALTER COLUMN subscription_status DROP DEFAULT;
ALTER TABLE teams ALTER COLUMN subscription_status DROP NOT NULL;
