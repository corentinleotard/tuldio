import { query } from '../../../lib/database/db.js';
import type { TeamFieldRow } from '../domain/team-field.entity.js';

export async function findTeamFields(teamId: string): Promise<TeamFieldRow[]> {
  const result = await query<TeamFieldRow>(
    'SELECT id, team_id, key, label, value, zone, show_quote, show_invoice, sort_order, is_system FROM team_fields WHERE team_id = $1 ORDER BY zone, sort_order',
    [teamId],
  );

  return result.rows;
}
