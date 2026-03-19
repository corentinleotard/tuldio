import { query } from '../../../lib/database/db.js';

export async function deleteStepsBySequence(input: {
  sequenceId: string;
}): Promise<void> {
  await query(
    `DELETE FROM god_sequence_steps WHERE sequence_id = $1`,
    [input.sequenceId],
  );
}
