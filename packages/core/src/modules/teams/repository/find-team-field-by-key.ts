import { query } from '../../../lib/database/db.js';
import type { TeamFieldRow } from '../domain/team-field.entity.js';

export async function findTeamFieldByKey(input: {
  teamId: string;
  key: string;
}): Promise<TeamFieldRow | null> {
  const result = await query<TeamFieldRow>(
    'SELECT * FROM team_fields WHERE team_id = $1 AND key = $2 LIMIT 1',
    [input.teamId, input.key],
  );

  return result.rows[0] ?? null;
}
