import { query } from '../../../lib/database/db.js';

export async function insertSequenceSend(input: {
  prospectId: string;
  sequenceId: string;
  stepOrder: number;
  channel: string;
  subject: string | null;
  body: string;
}): Promise<void> {
  await query(
    `INSERT INTO god_sequence_sends (id, prospect_id, sequence_id, step_order, channel, subject, body)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
    [input.prospectId, input.sequenceId, input.stepOrder, input.channel, input.subject, input.body],
  );
}
