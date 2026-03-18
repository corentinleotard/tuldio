import { query } from '../../../lib/database/db.js';

export async function acceptTerms(input: { teamId: string }): Promise<void> {
  await query(
    'UPDATE teams SET terms_accepted_at = NOW() WHERE id = $1',
    [input.teamId],
  );
}
