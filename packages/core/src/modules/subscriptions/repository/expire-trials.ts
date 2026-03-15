import { query } from '../../../lib/database/db.js';

export async function expireTrials(): Promise<number> {
  const result = await query(
    "UPDATE teams SET subscription_status = 'expired' WHERE subscription_status = 'trial' AND trial_ends_at < NOW()",
    [],
  );

  return result.rowCount ?? 0;
}
