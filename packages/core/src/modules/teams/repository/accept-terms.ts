import { query } from '../../../lib/database/db.js';
import type { TeamRow } from '../domain/team.entity.js';

export async function acceptTerms(input: { teamId: string }): Promise<TeamRow> {
  const result = await query<TeamRow>(
    'UPDATE teams SET terms_accepted_at = NOW() WHERE id = $1 RETURNING id, name, logo_url, original_document_url, quote_last_number, quote_validity_days, invoice_last_number, avoir_last_number, invoice_payment_delay_days, terms_accepted_at, stripe_customer_id, trial_ends_at, subscription_status, created_at',
    [input.teamId],
  );
  return result.rows[0]!;
}
