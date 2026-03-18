import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';

const insertTeamSchema = z.object({
  name: z.string(),
});

export async function insertTeam(input: {
  name: string;
}): Promise<{ id: string }> {
  const validated = insertTeamSchema.parse(input);
  const id = generateId();

  const result = await query<{ id: string }>(
    `INSERT INTO teams (id, name)
     VALUES ($1, $2)
     RETURNING id`,
    [id, validated.name],
  );

  return result.rows[0]!;
}
