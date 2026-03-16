import { query } from '../../../lib/database/db.js';
import type { DemandState } from '@tuldio/common';

export async function upsertDemandState(input: {
  userId: string;
  teamId: string;
  state: DemandState;
}): Promise<void> {
  await query(
    `INSERT INTO demand_states (user_id, team_id, state, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET state = $3, updated_at = now()`,
    [input.userId, input.teamId, JSON.stringify(input.state)],
  );
}
