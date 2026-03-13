import type { TeamSummary } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamById } from '../repository/find-team-by-id.js';
import { acceptTerms as acceptTermsRepo } from '../repository/accept-terms.js';
import { findTeamFields } from '../repository/find-team-fields.js';
import { toTeamSummary } from '../domain/team.view.js';
import { toTeamField } from '../domain/team-field.view.js';

export async function acceptTerms(input: { teamId: string }): Promise<TeamSummary> {
  const existing = await findTeamById(input.teamId);
  if (!existing) {
    throw new HandledError(errorCodes.teamNotFound);
  }

  const updated = await acceptTermsRepo(input);
  const fieldRows = await findTeamFields(input.teamId);
  return toTeamSummary(updated, fieldRows.map(toTeamField));
}
