import { findSequenceById } from '../repository/find-sequence-by-id.js';
import { findStepsBySequence } from '../repository/find-steps-by-sequence.js';
import { assignProspectsToSequence } from '../repository/assign-prospects-to-sequence.js';

export async function assignToSequence(input: {
  prospectIds: string[];
  sequenceId: string;
}): Promise<{ assigned: number }> {
  const sequence = await findSequenceById({ id: input.sequenceId });
  if (!sequence) {
    throw new Error('Séquence introuvable');
  }
  if (!sequence.isActive) {
    throw new Error('Cette séquence est désactivée');
  }

  const steps = await findStepsBySequence({ sequenceId: input.sequenceId });
  if (steps.length === 0) {
    throw new Error('Cette séquence n\'a aucune étape');
  }

  // First step delay determines when the prospect gets their first message
  const firstStep = steps[0]!;
  const nextStepAt = new Date(Date.now() + firstStep.delayDays * 24 * 60 * 60 * 1000);

  const assigned = await assignProspectsToSequence({
    prospectIds: input.prospectIds,
    sequenceId: input.sequenceId,
    firstStepOrder: firstStep.stepOrder,
    nextStepAt,
  });

  return { assigned };
}
