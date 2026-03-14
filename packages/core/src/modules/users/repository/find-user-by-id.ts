import { query } from '../../../lib/database/db.js';
import type { UserRow } from '../domain/user.entity.js';

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    'SELECT id, team_id, email, phone, name, role, god, has_seen_document_guide, created_at FROM users WHERE id = $1 LIMIT 1',
    [id],
  );

  return result.rows[0] ?? null;
}
