import type { TeamSummary } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamById } from '../repository/find-team-by-id.js';
import { updateTeam as updateTeamRepo } from '../repository/update-team.js';

export async function updateTeam(input: {
  teamId: string;
  name?: string;
  siret?: string;
  address?: string;
}): Promise<TeamSummary> {
  const existing = await findTeamById(input.teamId);
  if (!existing) {
    throw new HandledError(errorCodes.teamNotFound);
  }

  const updated = await updateTeamRepo(input);

  return {
    id: updated.id,
    name: updated.name,
    siret: updated.siret,
    subscriptionStatus: updated.subscription_status,
    trialEndsAt: updated.trial_ends_at?.toISOString() ?? null,
  };
}
