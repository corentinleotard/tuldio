import { query } from '../../../lib/database/db.js';
import type { UserRow } from '../domain/user.entity.js';

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    'SELECT id, team_id, email, phone, name, role, god, created_at FROM users WHERE email = $1 LIMIT 1',
    [email],
  );

  return result.rows[0] ?? null;
}
