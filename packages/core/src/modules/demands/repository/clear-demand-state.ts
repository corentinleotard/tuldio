import { query } from '../../../lib/database/db.js';

export async function clearDemandState(input: {
  userId: string;
}): Promise<void> {
  await query('DELETE FROM demand_states WHERE user_id = $1', [input.userId]);
}
