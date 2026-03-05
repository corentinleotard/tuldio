import { query } from '../../../lib/database/db.js';
import type { TeamRow } from '../domain/team.entity.js';

export async function updateTeam(input: {
  teamId: string;
  name?: string;
  siret?: string;
  address?: string;
}): Promise<TeamRow> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${idx++}`);
    params.push(input.name);
  }
  if (input.siret !== undefined) {
    fields.push(`siret = $${idx++}`);
    params.push(input.siret);
  }
  if (input.address !== undefined) {
    fields.push(`address = $${idx++}`);
    params.push(input.address);
  }

  if (fields.length === 0) {
    const result = await query<TeamRow>(
      'SELECT * FROM teams WHERE id = $1',
      [input.teamId],
    );
    return result.rows[0]!;
  }

  params.push(input.teamId);
  const teamIdIdx = idx;

  const result = await query<TeamRow>(
    `UPDATE teams SET ${fields.join(', ')} WHERE id = $${teamIdIdx} RETURNING *`,
    params,
  );

  return result.rows[0]!;
}
