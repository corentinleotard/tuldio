import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { deleteTeamField as deleteTeamFieldRepo } from '../repository/delete-team-field.js';

export async function deleteTeamField(input: {
  teamId: string;
  fieldId: string;
}): Promise<void> {
  const deleted = await deleteTeamFieldRepo(input);
  if (!deleted) {
    throw new HandledError(errorCodes.teamNotFound);
  }
}
