import { query } from '../../../lib/database/db.js';
import type { TeamFieldRow } from '../domain/team-field.entity.js';

export async function upsertTeamField(input: {
  teamId: string;
  fieldId: string;
  value?: string;
  showQuote?: boolean;
  showInvoice?: boolean;
}): Promise<TeamFieldRow> {
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

  if (sets.length === 0) {
    const result = await query<TeamFieldRow>(
      'SELECT * FROM team_fields WHERE id = $1 AND team_id = $2',
      [input.fieldId, input.teamId],
    );
    return result.rows[0]!;
  }

  params.push(input.fieldId, input.teamId);

  const result = await query<TeamFieldRow>(
    `UPDATE team_fields SET ${sets.join(', ')} WHERE id = $${idx} AND team_id = $${idx + 1} RETURNING *`,
    params,
  );

  return result.rows[0]!;
}
