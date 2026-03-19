import { query } from '../../../lib/database/db.js';

export interface SequenceStatsRow {
  totalAssigned: number;
  active: number;
  completed: number;
  replied: number;
  paused: number;
  error: number;
}

export async function findSequenceStats(input: {
  sequenceId: string;
}): Promise<SequenceStatsRow> {
  const result = await query<SequenceStatsRow>(
    `SELECT
       COUNT(*)::int AS "totalAssigned",
       COUNT(*) FILTER (WHERE sequence_status = 'active')::int AS active,
       COUNT(*) FILTER (WHERE sequence_status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE sequence_status = 'replied')::int AS replied,
       COUNT(*) FILTER (WHERE sequence_status = 'paused')::int AS paused,
       COUNT(*) FILTER (WHERE sequence_status = 'error')::int AS error
     FROM god_prospects
     WHERE sequence_id = $1`,
    [input.sequenceId],
  );
  return result.rows[0] ?? { totalAssigned: 0, active: 0, completed: 0, replied: 0, paused: 0, error: 0 };
}
