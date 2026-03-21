import { withTransaction } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { insertSequenceSteps } from '../repository/insert-sequence-steps.js';

export async function createSequence(input: {
  name: string;
  steps: Array<{
    stepOrder: number;
    channel: string;
    delayDays: number;
    subject: string | null;
    body: string;
    linkText: string | null;
  }>;
}): Promise<{ id: string }> {
  if (!input.name.trim()) {
    throw new Error('Le nom de la sequence est requis');
  }
  if (input.steps.length === 0) {
    throw new Error('Au moins une etape est requise');
  }

  return withTransaction(async (tx) => {
    const id = generateId();
    await tx.query(
      `INSERT INTO god_sequences (id, name) VALUES ($1, $2)`,
      [id, input.name.trim()],
    );

    await insertSequenceSteps({ sequenceId: id, steps: input.steps, tx });

    return { id };
  });
}
