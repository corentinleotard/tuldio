import { query } from '../../../lib/database/db.js';
import type { TemplateRow } from '../domain/template.entity.js';

export async function findTemplateById(input: {
  teamId: string;
  templateId: string;
}): Promise<TemplateRow | null> {
  const result = await query<TemplateRow>(
    `SELECT * FROM templates
     WHERE id = $1 AND team_id = $2
     LIMIT 1`,
    [input.templateId, input.teamId],
  );

  return result.rows[0] ?? null;
}
