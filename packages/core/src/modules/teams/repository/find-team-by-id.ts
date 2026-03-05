import { query } from '../../../lib/database/db.js';
import type { TeamRow } from '../domain/team.entity.js';

export async function findTeamById(id: string): Promise<TeamRow | null> {
  const result = await query<TeamRow>(
    'SELECT * FROM teams WHERE id = $1 LIMIT 1',
    [id],
  );

  return result.rows[0] ?? null;
}
