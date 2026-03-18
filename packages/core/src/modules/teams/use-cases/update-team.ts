import type { TeamSummary, UpdateTeamRequest } from '@tuldio/common';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamById } from '../repository/find-team-by-id.js';
import { updateTeamName } from '../repository/update-team.js';
import { findTeamFields } from '../repository/find-team-fields.js';
import { toTeamSummary } from '../domain/team.view.js';
import { toTeamField } from '../domain/team-field.view.js';

export async function updateTeam(input: {
  teamId: string;
} & UpdateTeamRequest): Promise<TeamSummary> {
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length === 0) {
      throw new HandledError(errorCodes.nameRequired);
    }
    if (trimmed.length > 200) {
      throw new HandledError(errorCodes.nameTooLong);
    }
  }

  const existing = await findTeamById(input.teamId);
  if (!existing) {
    throw new HandledError(errorCodes.teamNotFound);
  }

  if (input.name) {
    await updateTeamName({ teamId: input.teamId, name: input.name.trim() });
  }

  const teamRow = input.name ? await findTeamById(input.teamId) : existing;
  const fieldRows = await findTeamFields(input.teamId);
  return toTeamSummary(teamRow!, fieldRows.map(toTeamField));
}
