import { query } from '../../../lib/database/db.js';
import type { TeamRow } from '../domain/team.entity.js';

export async function findTeamById(id: string): Promise<TeamRow | null> {
  const result = await query<TeamRow>(
    'SELECT id, name, logo_url, original_document_url, terms_accepted_at, stripe_customer_id, trial_ends_at, subscription_status, created_at FROM teams WHERE id = $1 LIMIT 1',
    [id],
  );

  return result.rows[0] ?? null;
}
