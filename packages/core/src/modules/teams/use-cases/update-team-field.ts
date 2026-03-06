import type { TeamField, UpdateTeamFieldRequest } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { upsertTeamField } from '../repository/upsert-team-field.js';
import { toTeamField } from '../domain/team-field.view.js';

export async function updateTeamField(input: {
  teamId: string;
  fieldId: string;
} & UpdateTeamFieldRequest): Promise<TeamField> {
  const { teamId, fieldId, value, showQuote, showInvoice } = input;

  let effectiveShowQuote = showQuote;
  let effectiveShowInvoice = showInvoice;

  // UX rule: when user changes a value and both show flags are false → auto-enable both
  if (value !== undefined && showQuote === undefined && showInvoice === undefined) {
    // We need to check current state — but the upsert will handle this
    // We'll read the current row first
    const { query: dbQuery } = await import('../../../lib/database/db.js');
    const result = await dbQuery(
      'SELECT show_quote, show_invoice FROM team_fields WHERE id = $1 AND team_id = $2',
      [fieldId, teamId],
    );
    const current = result.rows[0];
    if (!current) throw new HandledError(errorCodes.teamNotFound);

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

  return toTeamField(row);
}
