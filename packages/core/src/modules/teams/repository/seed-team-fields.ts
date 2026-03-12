import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { SYSTEM_FIELDS } from '../domain/team-field.entity.js';

export async function seedTeamFields(teamId: string): Promise<void> {
  if (SYSTEM_FIELDS.length === 0) return;

  const values: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const field of SYSTEM_FIELDS) {
    values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, true)`);
    params.push(generateId(), teamId, field.key, field.label, field.defaultValue ?? '', field.zone, field.scope, field.showQuote, field.showInvoice, field.sortOrder);
    idx += 10;
  }

  await query(
    `INSERT INTO team_fields (id, team_id, key, label, value, zone, scope, show_quote, show_invoice, sort_order, is_system)
     VALUES ${values.join(', ')}
     ON CONFLICT (team_id, key) DO NOTHING`,
    params,
  );
}
