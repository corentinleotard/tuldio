-- Backfill payment_terms default for existing teams that have it empty
UPDATE team_fields
SET value = 'Paiement a reception de facture'
WHERE key = 'payment_terms'
  AND (value = '' OR value IS NULL);
