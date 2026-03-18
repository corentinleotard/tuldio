import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { FieldZone, FieldScope } from '../domain/team-field.entity.js';

export async function insertTeamField(input: {
  teamId: string;
  key: string;
  label: string;
  value: string;
  zone: FieldZone;
  scope: FieldScope;
  showQuote: boolean;
  showInvoice: boolean;
  sortOrder: number;
  isSystem: boolean;
}): Promise<{ id: string }> {
  const id = generateId();

  const result = await query<{ id: string }>(
    `INSERT INTO team_fields (id, team_id, key, label, value, zone, scope, show_quote, show_invoice, sort_order, is_system)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [id, input.teamId, input.key, input.label, input.value, input.zone, input.scope, input.showQuote, input.showInvoice, input.sortOrder, input.isSystem],
  );

  return result.rows[0]!;
}
