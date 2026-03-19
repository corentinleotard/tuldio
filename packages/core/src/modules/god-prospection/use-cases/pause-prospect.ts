import { updateProspectSequenceStatus } from '../repository/update-prospect-sequence-status.js';

export async function pauseProspectUc(input: {
  prospectId: string;
  paused: boolean;
}): Promise<void> {
  await updateProspectSequenceStatus({
    prospectId: input.prospectId,
    sequenceStatus: input.paused ? 'paused' : 'active',
  });
}
