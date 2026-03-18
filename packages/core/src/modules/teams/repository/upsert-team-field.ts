import { query } from '../../../lib/database/db.js';

export async function upsertTeamField(input: {
  teamId: string;
  fieldId: string;
  value?: string;
  showQuote?: boolean;
  showInvoice?: boolean;
}): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.value !== undefined) {
    sets.push(`value = $${idx++}`);
    params.push(input.value);
  }
  if (input.showQuote !== undefined) {
    sets.push(`show_quote = $${idx++}`);
    params.push(input.showQuote);
  }
  if (input.showInvoice !== undefined) {
    sets.push(`show_invoice = $${idx++}`);
    params.push(input.showInvoice);
  }

  if (sets.length === 0) return;

  params.push(input.fieldId, input.teamId);

  await query(
    `UPDATE team_fields SET ${sets.join(', ')} WHERE id = $${idx} AND team_id = $${idx + 1}`,
    params,
  );
}
