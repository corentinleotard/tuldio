import { query } from '../../../lib/database/db.js';

export async function advanceProspectStep(input: {
  prospectId: string;
  nextStepOrder: number;
  nextStepAt: Date | null;
  sequenceStatus: string;
}): Promise<void> {
  await query(
    `UPDATE god_prospects
     SET current_step = $1,
         next_step_at = $2,
         sequence_status = $3,
         updated_at = now()
     WHERE id = $4`,
    [input.nextStepOrder, input.nextStepAt?.toISOString() ?? null, input.sequenceStatus, input.prospectId],
  );
}
