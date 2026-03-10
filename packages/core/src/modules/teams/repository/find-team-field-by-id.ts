import { query } from '../../../lib/database/db.js';
import type { TeamFieldRow } from '../domain/team-field.entity.js';

export async function findTeamFieldById(input: {
  teamId: string;
  fieldId: string;
}): Promise<TeamFieldRow | null> {
  const result = await query<TeamFieldRow>(
    'SELECT id, team_id, key, label, value, zone, show_quote, show_invoice, sort_order, is_system FROM team_fields WHERE id = $1 AND team_id = $2 LIMIT 1',
    [input.fieldId, input.teamId],
  );

  return result.rows[0] ?? null;
}
