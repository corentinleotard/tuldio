import type { Request, Response } from 'express';
import type { BootstrapResponse } from '@tuldio/common';
import { getCurrentUser } from '@tuldio/core/users';
import { getTeam } from '@tuldio/core/teams';
import { listMessages } from '@tuldio/core/messages';
import { getUserId, getTeamId } from '../middleware/auth.js';

export async function handleBootstrap(_req: Request, res: Response): Promise<void> {
  const userId = getUserId(res);
  const teamId = getTeamId(res);

  const [user, team, messages] = await Promise.all([
    getCurrentUser(userId),
    getTeam(teamId),
    listMessages({ userId }),
  ]);

  const response: BootstrapResponse = {
    user,
    team,
    messages,
  };

  res.json({ data: response });
}
