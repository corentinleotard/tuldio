BEGIN;

-- Escompte, penalites de retard, indemnite de recouvrement = invoice-only legal obligations
UPDATE team_fields SET show_quote = false WHERE key IN ('early_payment_discount', 'late_penalty_rate', 'recovery_fee');

COMMIT;
