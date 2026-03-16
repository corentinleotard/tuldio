import type { Request, Response } from 'express';
import type { UpdateTeamRequest } from '@tuldio/common';
import { updateTeam } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleUpdateTeam(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const body = req.body as UpdateTeamRequest;
  const team = await updateTeam({ teamId, ...body });

  res.json({ data: team });
}
