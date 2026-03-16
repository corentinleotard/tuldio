import type { TeamSummary } from '@tuldio/common';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamById } from '../repository/find-team-by-id.js';
import { findTeamFields } from '../repository/find-team-fields.js';
import { toTeamSummary } from '../domain/team.view.js';
import { toTeamField } from '../domain/team-field.view.js';

export async function getTeam(teamId: string): Promise<TeamSummary> {
  const [team, fieldRows] = await Promise.all([
    findTeamById(teamId),
    findTeamFields(teamId),
  ]);

  if (!team) {
    throw new HandledError(errorCodes.teamNotFound);
  }

  return toTeamSummary(team, fieldRows.map(toTeamField));
}
