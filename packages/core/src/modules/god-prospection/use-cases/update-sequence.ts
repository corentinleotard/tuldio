import { withTransaction } from '../../../lib/database/db.js';
import { findSequenceById } from '../repository/find-sequence-by-id.js';
import { insertSequenceSteps } from '../repository/insert-sequence-steps.js';

export async function updateSequenceUc(input: {
  id: string;
  name?: string;
  isActive?: boolean;
  steps?: Array<{
    stepOrder: number;
    channel: string;
    delayDays: number;
    subject: string | null;
    body: string;
  }>;
}): Promise<void> {
  const sequence = await findSequenceById({ id: input.id });
  if (!sequence) {
    throw new Error('Sequence introuvable');
  }

  await withTransaction(async (tx) => {
    const sets: string[] = ['updated_at = now()'];
    const params: Array<string | boolean> = [];

    if (input.name !== undefined) {
      params.push(input.name);
      sets.push(`name = $${params.length}`);
    }
    if (input.isActive !== undefined) {
      params.push(input.isActive);
      sets.push(`is_active = $${params.length}`);
    }

    params.push(input.id);
    await tx.query(
      `UPDATE god_sequences SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params,
    );

    if (input.steps) {
      await tx.query(
        `DELETE FROM god_sequence_steps WHERE sequence_id = $1`,
        [input.id],
      );

      await insertSequenceSteps({ sequenceId: input.id, steps: input.steps, tx });
    }
  });
}
