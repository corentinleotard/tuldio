import type { TeamSummary } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamById } from '../repository/find-team-by-id.js';

export async function getTeam(teamId: string): Promise<TeamSummary> {
  const team = await findTeamById(teamId);
  if (!team) {
    throw new HandledError(errorCodes.teamNotFound);
  }

  return {
    id: team.id,
    name: team.name,
    siret: team.siret,
    subscriptionStatus: team.subscription_status,
    trialEndsAt: team.trial_ends_at?.toISOString() ?? null,
  };
}
