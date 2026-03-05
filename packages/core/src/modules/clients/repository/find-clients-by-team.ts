import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function findClientsByTeam(teamId: string): Promise<ClientRow[]> {
  const result = await query<ClientRow>(
    'SELECT * FROM clients WHERE team_id = $1 ORDER BY name ASC',
    [teamId],
  );

  return result.rows;
}
