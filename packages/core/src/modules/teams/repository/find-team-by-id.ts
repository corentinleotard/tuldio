import { query } from '../../../lib/database/db.js';
import type { TeamRow } from '../domain/team.entity.js';

export async function findTeamById(id: string): Promise<TeamRow | null> {
  const result = await query<TeamRow>(
    'SELECT id, name, logo_url, original_document_url, quote_last_number, quote_validity_days, invoice_last_number, avoir_last_number, invoice_payment_delay_days, terms_accepted_at, stripe_customer_id, stripe_subscription_id, trial_ends_at, subscription_status, subscription_period_start, subscription_period_end, cancel_at_period_end, ai_cost_limit_cents, created_at FROM teams WHERE id = $1 LIMIT 1',
    [id],
  );

  return result.rows[0] ?? null;
}
