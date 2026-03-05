import { query } from '../../../lib/database/db.js';

export async function findUserByIdRepo(userId: string): Promise<{ team_id: string } | null> {
  const result = await query<{ team_id: string }>(
    'SELECT team_id FROM users WHERE id = $1 LIMIT 1',
    [userId],
  );

  return result.rows[0] ?? null;
}
