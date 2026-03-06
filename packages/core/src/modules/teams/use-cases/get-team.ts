import type { TeamSummary } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamById } from '../repository/find-team-by-id.js';
import { toTeamSummary } from '../domain/team.view.js';

export async function getTeam(teamId: string): Promise<TeamSummary> {
  const team = await findTeamById(teamId);
  if (!team) {
    throw new HandledError(errorCodes.teamNotFound);
  }

  return toTeamSummary(team);
}
