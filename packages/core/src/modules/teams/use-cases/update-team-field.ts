import type { TeamField, UpdateTeamFieldRequest } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { isFieldTrue } from '../domain/team-field.entity.js';
import { MANDATORY_INVOICE_FIELD_KEYS, MANDATORY_QUOTE_FIELD_KEYS } from '../../documents/domain/validate-document-ready.js';
import { findTeamFieldById } from '../repository/find-team-field-by-id.js';
import { upsertTeamField } from '../repository/upsert-team-field.js';
import { refreshDraftDocuments } from '../repository/refresh-draft-documents.js';
import { toTeamField } from '../domain/team-field.view.js';

export async function updateTeamField(input: {
  teamId: string;
  fieldId: string;
} & UpdateTeamFieldRequest): Promise<TeamField> {
  const { teamId, fieldId, value } = input;
  let { showQuote, showInvoice } = input;

  const current = await findTeamFieldById({ teamId, fieldId });
  if (!current) throw new HandledError(errorCodes.teamNotFound);

  // Block emptying mandatory document fields (invoice legal mentions + quote payment terms)
  if (value !== undefined && !value.trim()) {
    const allMandatoryKeys: readonly string[] = [...MANDATORY_INVOICE_FIELD_KEYS, ...MANDATORY_QUOTE_FIELD_KEYS];
    if (allMandatoryKeys.includes(current.key)) {
      throw new HandledError(errorCodes.mandatoryFieldCannotBeEmpty);
    }
  }

  // Enforce scope constraints
  if (current.scope === 'quote') {
    showInvoice = undefined; // never change show_invoice for quote-scoped fields
  } else if (current.scope === 'invoice') {
    showQuote = undefined; // never change show_quote for invoice-scoped fields
  }

  let effectiveShowQuote = showQuote;
  let effectiveShowInvoice = showInvoice;

  // UX rule: when user changes a value and both applicable show flags are false → auto-enable
  if (value !== undefined && showQuote === undefined && showInvoice === undefined) {
    if (current.scope === 'both' && !current.show_quote && !current.show_invoice) {
      effectiveShowQuote = true;
      effectiveShowInvoice = true;
    } else if (current.scope === 'quote' && !current.show_quote) {
      effectiveShowQuote = true;
    } else if (current.scope === 'invoice' && !current.show_invoice) {
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
    await refreshDraftDocuments({ teamId, tvaExempt: isFieldTrue(row) });
  }

  return toTeamField(row);
}
