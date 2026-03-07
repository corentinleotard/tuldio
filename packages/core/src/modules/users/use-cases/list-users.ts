import { query } from '../../../lib/database/db.js';
import { getCurrentUser } from './get-current-user.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';

interface UserSummary {
  id: string;
  name: string;
  email: string;
  teamId: string;
}

export async function listUsers(input: { godUserId: string; limit?: number }): Promise<UserSummary[]> {
  const god = await getCurrentUser(input.godUserId);
  if (!god.god) {
    throw new HandledError(errorCodes.forbidden);
  }

  const result = await query<{ id: string; name: string; email: string; team_id: string }>(
    `SELECT id, name, email, team_id FROM users ORDER BY created_at DESC LIMIT $1`,
    [input.limit ?? 1000],
  );

  return result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    teamId: r.team_id,
  }));
}
