import type { AuthUser } from '@tuldio/common';
import { insertUser } from '../repository/insert-user.js';

export async function createUser(input: {
  teamId: string;
  email: string | null;
  name: string;
  role: 'owner' | 'member';
}): Promise<AuthUser> {
  const user = await insertUser(input);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    teamId: user.team_id,
    role: user.role,
    god: user.god,
  };
}
