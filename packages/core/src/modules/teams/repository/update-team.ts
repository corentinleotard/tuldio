import { query } from '../../../lib/database/db.js';

export async function updateTeamName(input: {
  teamId: string;
  name: string;
}): Promise<void> {
  await query(
    'UPDATE teams SET name = $1 WHERE id = $2',
    [input.name, input.teamId],
  );
}

export async function updateTeamMeta(input: {
  teamId: string;
  logoUrl?: string;
  originalDocumentUrl?: string;
}): Promise<void> {
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

  if (sets.length === 0) return;

  values.push(input.teamId);
  await query(
    `UPDATE teams SET ${sets.join(', ')} WHERE id = $${i}`,
    values,
  );
}
