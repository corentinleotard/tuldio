import { findSequenceById } from '../repository/find-sequence-by-id.js';
import { findSequenceStats } from '../repository/find-sequence-stats.js';
import { deleteSequence as deleteSequenceRepo } from '../repository/delete-sequence.js';

export async function deleteSequenceUc(input: {
  id: string;
}): Promise<void> {
  const sequence = await findSequenceById({ id: input.id });
  if (!sequence) {
    throw new Error('Séquence introuvable');
  }

  const stats = await findSequenceStats({ sequenceId: input.id });
  if (stats.active > 0) {
    throw new Error(`Impossible de supprimer : ${stats.active} prospect(s) actif(s) sur cette séquence`);
  }

  await deleteSequenceRepo({ id: input.id });
}
