import type { AuthUser } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findUserById } from '../repository/find-user-by-id.js';

export async function getCurrentUser(userId: string): Promise<AuthUser> {
  const user = await findUserById(userId);
  if (!user) {
    throw new HandledError(errorCodes.userNotFound);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    teamId: user.team_id,
    role: user.role,
    god: user.god,
  };
}
