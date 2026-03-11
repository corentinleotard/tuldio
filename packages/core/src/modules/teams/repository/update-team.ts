import { query } from '../../../lib/database/db.js';
import type { TeamRow } from '../domain/team.entity.js';

export async function updateTeamName(input: {
  teamId: string;
  name: string;
}): Promise<TeamRow> {
  const result = await query<TeamRow>(
    'UPDATE teams SET name = $1 WHERE id = $2 RETURNING id, name, logo_url, original_document_url, quote_last_number, quote_validity_days, invoice_last_number, avoir_last_number, invoice_payment_delay_days, terms_accepted_at, stripe_customer_id, trial_ends_at, subscription_status, created_at',
    [input.name, input.teamId],
  );

  return result.rows[0]!;
}

export async function updateTeamMeta(input: {
  teamId: string;
  logoUrl?: string;
  originalDocumentUrl?: string;
}): Promise<TeamRow> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (input.logoUrl !== undefined) {
    sets.push(`logo_url = $${i++}`);
    values.push(input.logoUrl);
  }
  if (input.originalDocumentUrl !== undefined) {
    sets.push(`original_document_url = $${i++}`);
    values.push(input.originalDocumentUrl);
  }

  if (sets.length === 0) {
    const result = await query<TeamRow>('SELECT id, name, logo_url, original_document_url, quote_last_number, quote_validity_days, invoice_last_number, avoir_last_number, invoice_payment_delay_days, terms_accepted_at, stripe_customer_id, trial_ends_at, subscription_status, created_at FROM teams WHERE id = $1', [input.teamId]);
    return result.rows[0]!;
  }

  values.push(input.teamId);
  const result = await query<TeamRow>(
    `UPDATE teams SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, name, logo_url, original_document_url, quote_last_number, quote_validity_days, invoice_last_number, avoir_last_number, invoice_payment_delay_days, terms_accepted_at, stripe_customer_id, trial_ends_at, subscription_status, created_at`,
    values,
  );

  return result.rows[0]!;
}
