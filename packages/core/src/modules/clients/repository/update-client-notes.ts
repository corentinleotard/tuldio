import { query } from '../../../lib/database/db.js';
import type { ClientRow } from '../domain/client.entity.js';

export async function updateClientNotes(input: {
  teamId: string;
  clientId: string;
  notes: ClientRow['notes'];
}): Promise<void> {
  await query(
    `UPDATE clients SET notes = $1
     WHERE id = $2 AND team_id = $3`,
    [JSON.stringify(input.notes), input.clientId, input.teamId],
  );
}
