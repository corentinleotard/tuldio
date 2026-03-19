import { query } from '../../../lib/database/db.js';

export interface SequenceActivityRow {
  prospectName: string;
  channel: string;
  stepOrder: number;
  sentAt: string;
}

export async function findSequenceActivity(input: {
  sequenceId: string;
  limit: number;
}): Promise<SequenceActivityRow[]> {
  const result = await query<SequenceActivityRow>(
    `SELECT p.full_name AS "prospectName",
            s.channel,
            s.step_order AS "stepOrder",
            p.sent_at AS "sentAt"
     FROM god_prospects p
     JOIN god_sequence_steps s
       ON s.sequence_id = p.sequence_id
       AND s.step_order = p.current_step - 1
     WHERE p.sequence_id = $1
       AND p.sent_at IS NOT NULL
     ORDER BY p.sent_at DESC
     LIMIT $2`,
    [input.sequenceId, input.limit],
  );
  return result.rows;
}
