import { query } from '../../../lib/database/db.js';

export interface GodSequenceStepRow {
  id: string;
  sequenceId: string;
  stepOrder: number;
  channel: string;
  delayDays: number;
  subject: string | null;
  body: string;
}

export async function findStepsBySequence(input: {
  sequenceId: string;
}): Promise<GodSequenceStepRow[]> {
  const result = await query<GodSequenceStepRow>(
    `SELECT id, sequence_id AS "sequenceId", step_order AS "stepOrder",
            channel, delay_days AS "delayDays", subject, body
     FROM god_sequence_steps
     WHERE sequence_id = $1
     ORDER BY step_order ASC`,
    [input.sequenceId],
  );
  return result.rows;
}
