-- Set test prospect's next_step_at to now so the cron picks it up immediately
UPDATE god_prospects
SET next_step_at = now(), phone = '0631863377', updated_at = now()
WHERE email = 'leotardcorentin+testmagiclink@gmail.com'
  AND sequence_status = 'active';
