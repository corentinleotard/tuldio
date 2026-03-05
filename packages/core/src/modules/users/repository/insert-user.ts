import { z } from 'zod';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import type { UserRow } from '../domain/user.entity.js';

const insertUserSchema = z.object({
  teamId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['owner', 'member']),
});

export async function insertUser(input: {
  teamId: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
}): Promise<UserRow> {
  const validated = insertUserSchema.parse(input);
  const id = generateId();

  const result = await query<UserRow>(
    `INSERT INTO users (id, team_id, email, name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, validated.teamId, validated.email, validated.name, validated.role],
  );

  return result.rows[0]!;
}
