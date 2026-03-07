import { query } from '../../../lib/database/db.js';
import type { TeamRow } from '../domain/team.entity.js';

export async function acceptTerms(input: { teamId: string }): Promise<TeamRow> {
  const result = await query<TeamRow>(
    'UPDATE teams SET terms_accepted_at = NOW() WHERE id = $1 RETURNING id, name, logo_url, original_document_url, terms_accepted_at, stripe_customer_id, trial_ends_at, subscription_status, created_at',
    [input.teamId],
  );
  return result.rows[0]!;
}
