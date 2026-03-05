import { query } from '../../../lib/database/db.js';
import type { TemplateRow } from '../domain/template.entity.js';

export async function findTemplatesByTeam(teamId: string): Promise<TemplateRow[]> {
  const result = await query<TemplateRow>(
    'SELECT * FROM templates WHERE team_id = $1 ORDER BY created_at DESC',
    [teamId],
  );

  return result.rows;
}
