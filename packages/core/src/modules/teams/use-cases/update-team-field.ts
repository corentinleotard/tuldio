import type { TeamField, UpdateTeamFieldRequest } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamFieldById } from '../repository/find-team-field-by-id.js';
import { upsertTeamField } from '../repository/upsert-team-field.js';
import { updateDraftDocumentsTva } from '../repository/update-draft-documents-tva.js';
import { toTeamField } from '../domain/team-field.view.js';

export async function updateTeamField(input: {
  teamId: string;
  fieldId: string;
} & UpdateTeamFieldRequest): Promise<TeamField> {
  const { teamId, fieldId, value, showQuote, showInvoice } = input;

  const current = await findTeamFieldById({ teamId, fieldId });
  if (!current) throw new HandledError(errorCodes.teamNotFound);

  let effectiveShowQuote = showQuote;
  let effectiveShowInvoice = showInvoice;

  // UX rule: when user changes a value and both show flags are false → auto-enable both
  if (value !== undefined && showQuote === undefined && showInvoice === undefined) {
    if (!current.show_quote && !current.show_invoice) {
      effectiveShowQuote = true;
      effectiveShowInvoice = true;
    }
  }

  const row = await upsertTeamField({
    teamId,
    fieldId,
    value,
    showQuote: effectiveShowQuote,
    showInvoice: effectiveShowInvoice,
  });

  if (!row) throw new HandledError(errorCodes.teamNotFound);

  if (row.key === 'tva_exempt' && row.value !== current.value) {
    await updateDraftDocumentsTva({ teamId, tvaExempt: row.value === 'true' });
  }

  return toTeamField(row);
}
