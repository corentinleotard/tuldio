import { query } from '../../../lib/database/db.js';

/** Re-check that a prospect is still active before sending. Returns false if replied/paused/error/completed. */
export async function checkProspectStillActive(input: {
  prospectId: string;
}): Promise<boolean> {
  const result = await query<{ active: boolean }>(
    `SELECT sequence_status = 'active' AS active
     FROM god_prospects
     WHERE id = $1`,
    [input.prospectId],
  );
  return result.rows[0]?.active === true;
}
