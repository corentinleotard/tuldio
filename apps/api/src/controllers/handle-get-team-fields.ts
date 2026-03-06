import type { Request, Response } from 'express';
import { getTeamFields } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleGetTeamFields(_req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const fields = await getTeamFields(teamId);
  res.json({ data: fields });
}
