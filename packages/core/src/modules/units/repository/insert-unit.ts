import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';

export async function insertUnit(input: {
  teamId: string;
  label: string;
}): Promise<{ id: string; label: string }> {
  const id = generateId();
  await query(
    `INSERT INTO units (id, team_id, label, aliases) VALUES ($1, $2, $3, $4)`,
    [id, input.teamId, input.label, []],
  );
  return { id, label: input.label };
}
