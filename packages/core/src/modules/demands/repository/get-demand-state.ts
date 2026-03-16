import { query } from '../../../lib/database/db.js';
import type { DemandState } from '@tuldio/common';

export async function getDemandState(input: {
  userId: string;
}): Promise<DemandState> {
  const result = await query<{ state: DemandState }>(
    'SELECT state FROM demand_states WHERE user_id = $1',
    [input.userId],
  );

  if (result.rows.length === 0) return { client: null, document: null, pendingCandidates: null };
  return result.rows[0]!.state;
}
