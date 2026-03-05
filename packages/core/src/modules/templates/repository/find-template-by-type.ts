import { query } from '../../../lib/database/db.js';
import type { TemplateRow } from '../domain/template.entity.js';

export async function findTemplateByType(input: {
  teamId: string;
  type: 'quote' | 'invoice';
}): Promise<TemplateRow | null> {
  const result = await query<TemplateRow>(
    `SELECT * FROM templates
     WHERE team_id = $1 AND type = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.teamId, input.type],
  );

  return result.rows[0] ?? null;
}
