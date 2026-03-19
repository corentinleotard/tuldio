import { query } from '../../../lib/database/db.js';

export async function updateProspectSequenceStatus(input: {
  prospectId: string;
  sequenceStatus: 'paused' | 'active';
}): Promise<void> {
  await query(
    `UPDATE god_prospects
     SET sequence_status = $1, updated_at = now()
     WHERE id = $2
       AND sequence_status IN ('active', 'paused')`,
    [input.sequenceStatus, input.prospectId],
  );
}
