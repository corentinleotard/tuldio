import type { TeamSummary } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamById } from '../repository/find-team-by-id.js';
import { acceptTerms as acceptTermsRepo } from '../repository/accept-terms.js';
import { findTeamFields } from '../repository/find-team-fields.js';
import { upsertTeamField } from '../repository/upsert-team-field.js';
import { findMissingLegalDefaults } from '../domain/ensure-legal-defaults.js';
import { toTeamSummary } from '../domain/team.view.js';
import { toTeamField } from '../domain/team-field.view.js';

export async function acceptTerms(input: { teamId: string }): Promise<TeamSummary> {
  const existing = await findTeamById(input.teamId);
  if (!existing) {
    throw new HandledError(errorCodes.teamNotFound);
  }

  // Safety net: restore mandatory invoice defaults if any are empty
  const fieldRows = await findTeamFields(input.teamId);
  const missingDefaults = findMissingLegalDefaults(fieldRows);
  for (const { fieldId, defaultValue } of missingDefaults) {
    await upsertTeamField({ teamId: input.teamId, fieldId, value: defaultValue });
  }

  const updated = await acceptTermsRepo(input);
  const finalFields = missingDefaults.length > 0 ? await findTeamFields(input.teamId) : fieldRows;
  return toTeamSummary(updated, finalFields.map(toTeamField));
}
