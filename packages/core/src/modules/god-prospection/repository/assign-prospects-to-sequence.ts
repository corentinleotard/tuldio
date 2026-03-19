import { query } from '../../../lib/database/db.js';

export async function assignProspectsToSequence(input: {
  prospectIds: string[];
  sequenceId: string;
  firstStepOrder: number;
  nextStepAt: Date;
}): Promise<number> {
  if (input.prospectIds.length === 0) return 0;

  const result = await query<{ count: string }>(
    `UPDATE god_prospects
     SET sequence_id = $1,
         current_step = $2,
         next_step_at = $3,
         sequence_status = 'active',
         updated_at = now()
     WHERE id = ANY($4::uuid[])
       AND (sequence_status IS NULL OR sequence_status IN ('completed', 'error', 'paused'))
     RETURNING id`,
    [input.sequenceId, input.firstStepOrder, input.nextStepAt.toISOString(), input.prospectIds],
  );

  return result.rows.length;
}
