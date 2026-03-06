import { query } from '../../../lib/database/db.js';

export async function deleteTeamField(input: {
  teamId: string;
  fieldId: string;
}): Promise<boolean> {
  const result = await query(
    'DELETE FROM team_fields WHERE id = $1 AND team_id = $2 AND is_system = false',
    [input.fieldId, input.teamId],
  );

  return (result.rowCount ?? 0) > 0;
}
