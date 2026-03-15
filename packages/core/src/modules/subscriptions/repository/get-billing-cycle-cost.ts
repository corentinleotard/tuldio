import { query } from '../../../lib/database/db.js';

export async function getBillingCycleCost(input: {
  teamId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<number> {
  const result = await query<{ total: string }>(
    'SELECT COALESCE(SUM(cost_cents), 0) AS total FROM ai_calls WHERE team_id = $1 AND created_at >= $2 AND created_at < $3',
    [input.teamId, input.periodStart, input.periodEnd],
  );

  return parseInt(result.rows[0]!.total, 10);
}
