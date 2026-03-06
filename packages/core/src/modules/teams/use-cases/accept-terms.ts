import type { TeamSummary } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamById } from '../repository/find-team-by-id.js';
import { acceptTerms as acceptTermsRepo } from '../repository/accept-terms.js';
import { findTeamFields } from '../repository/find-team-fields.js';
import { findTeamFieldByKey } from '../repository/find-team-field-by-key.js';
import { upsertTeamField } from '../repository/upsert-team-field.js';
import { toTeamSummary } from '../domain/team.view.js';
import { toTeamField } from '../domain/team-field.view.js';

// Legal defaults for manual onboarding (no uploaded document)
const LEGAL_DEFAULTS: Record<string, string> = {
  early_payment_discount: "Pas d'escompte pour paiement anticipe.",
  late_penalty_rate: 'Penalites de retard : 3 fois le taux legal en vigueur.',
  recovery_fee: '4000', // 40,00 EUR in cents
};

export async function acceptTerms(input: { teamId: string }): Promise<TeamSummary> {
  const existing = await findTeamById(input.teamId);
  if (!existing) {
    throw new HandledError(errorCodes.teamNotFound);
  }

  // Manual path: no uploaded document → populate legal defaults for empty fields
  const docField = await findTeamFieldByKey({ teamId: input.teamId, key: 'original_document_url' });
  if (!docField || !docField.value) {
    for (const [key, defaultValue] of Object.entries(LEGAL_DEFAULTS)) {
      const field = await findTeamFieldByKey({ teamId: input.teamId, key });
      if (field && !field.value) {
        await upsertTeamField({ teamId: input.teamId, fieldId: field.id, value: defaultValue });
      }
    }
  }

  const updated = await acceptTermsRepo(input);
  const fieldRows = await findTeamFields(input.teamId);
  return toTeamSummary(updated, fieldRows.map(toTeamField));
}
