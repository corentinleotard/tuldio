import { query } from '../../../lib/database/db.js';

export async function insertSequenceSend(input: {
  prospectId: string;
  sequenceId: string;
  stepOrder: number;
  channel: string;
}): Promise<void> {
  await query(
    `INSERT INTO god_sequence_sends (id, prospect_id, sequence_id, step_order, channel)
     VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
    [input.prospectId, input.sequenceId, input.stepOrder, input.channel],
  );
}
