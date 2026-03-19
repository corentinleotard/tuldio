import { query } from '../../../lib/database/db.js';

export interface SequenceFunnelRow {
  stepOrder: number;
  channel: string;
  sent: number;
  pending: number;
}

export async function findSequenceFunnel(input: {
  sequenceId: string;
}): Promise<SequenceFunnelRow[]> {
  const result = await query<SequenceFunnelRow>(
    `SELECT s.step_order AS "stepOrder", s.channel,
            COUNT(*) FILTER (WHERE p.current_step > s.step_order)::int AS sent,
            COUNT(*) FILTER (WHERE p.current_step = s.step_order AND p.sequence_status = 'active')::int AS pending
     FROM god_sequence_steps s
     LEFT JOIN god_prospects p ON p.sequence_id = s.sequence_id
     WHERE s.sequence_id = $1
     GROUP BY s.step_order, s.channel
     ORDER BY s.step_order ASC`,
    [input.sequenceId],
  );
  return result.rows;
}
