import { query } from '../../../lib/database/db.js';
import type { TeamRow } from '../domain/team.entity.js';

export async function updateTeamName(input: {
  teamId: string;
  name: string;
}): Promise<TeamRow> {
  const result = await query<TeamRow>(
    'UPDATE teams SET name = $1 WHERE id = $2 RETURNING *',
    [input.name, input.teamId],
  );

  return result.rows[0]!;
}

export async function updateTeamMeta(input: {
  teamId: string;
  logoUrl?: string;
  originalDocumentUrl?: string;
}): Promise<TeamRow> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (input.logoUrl !== undefined) {
    sets.push(`logo_url = $${i++}`);
    values.push(input.logoUrl);
  }
  if (input.originalDocumentUrl !== undefined) {
    sets.push(`original_document_url = $${i++}`);
    values.push(input.originalDocumentUrl);
  }

  if (sets.length === 0) {
    const result = await query<TeamRow>('SELECT * FROM teams WHERE id = $1', [input.teamId]);
    return result.rows[0]!;
  }

  values.push(input.teamId);
  const result = await query<TeamRow>(
    `UPDATE teams SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values,
  );

  return result.rows[0]!;
}
