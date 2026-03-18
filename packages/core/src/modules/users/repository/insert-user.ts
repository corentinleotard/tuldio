import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';

const insertUserSchema = z.object({
  teamId: z.string().uuid(),
  email: z.string().email().nullable(),
  name: z.string().min(1),
  role: z.enum(['owner', 'member']),
});

export async function insertUser(input: {
  teamId: string;
  email: string | null;
  name: string;
  role: 'owner' | 'member';
}): Promise<{ id: string }> {
  const validated = insertUserSchema.parse(input);
  const id = generateId();

  const result = await query<{ id: string }>(
    `INSERT INTO users (id, team_id, email, name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [id, validated.teamId, validated.email, validated.name, validated.role],
  );

  return { id: result.rows[0]!.id };
}
