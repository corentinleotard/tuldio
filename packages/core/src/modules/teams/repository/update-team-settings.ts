import { query } from '../../../lib/database/db.js';
import type { TeamRow } from '../domain/team.entity.js';

export async function updateTeamSettings(input: {
  teamId: string;
  quoteLastNumber?: number;
  quoteValidityDays?: number;
  invoiceLastNumber?: number;
  invoicePaymentDelayDays?: number;
}): Promise<TeamRow> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.quoteLastNumber !== undefined) {
    sets.push(`quote_last_number = $${idx++}`);
    params.push(input.quoteLastNumber);
  }
  if (input.quoteValidityDays !== undefined) {
    sets.push(`quote_validity_days = $${idx++}`);
    params.push(input.quoteValidityDays);
  }
  if (input.invoiceLastNumber !== undefined) {
    sets.push(`invoice_last_number = $${idx++}`);
    params.push(input.invoiceLastNumber);
  }
  if (input.invoicePaymentDelayDays !== undefined) {
    sets.push(`invoice_payment_delay_days = $${idx++}`);
    params.push(input.invoicePaymentDelayDays);
  }

  if (sets.length === 0) {
    const result = await query<TeamRow>(
      'SELECT id, name, logo_url, original_document_url, quote_last_number, quote_validity_days, invoice_last_number, avoir_last_number, invoice_payment_delay_days, terms_accepted_at, stripe_customer_id, trial_ends_at, subscription_status, created_at FROM teams WHERE id = $1 LIMIT 1',
      [input.teamId],
    );
    return result.rows[0]!;
  }

  params.push(input.teamId);

  const result = await query<TeamRow>(
    `UPDATE teams SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, logo_url, original_document_url, quote_last_number, quote_validity_days, invoice_last_number, avoir_last_number, invoice_payment_delay_days, terms_accepted_at, stripe_customer_id, trial_ends_at, subscription_status, created_at`,
    params,
  );

  return result.rows[0]!;
}
