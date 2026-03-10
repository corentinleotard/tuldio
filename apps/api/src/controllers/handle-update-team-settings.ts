import type { Request, Response } from 'express';
import type { UpdateTeamSettingsRequest } from '@tuldio/types';
import { updateTeamSettings } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleUpdateTeamSettings(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const body = req.body as UpdateTeamSettingsRequest;

  const team = await updateTeamSettings({ teamId, ...body });
  res.json({ data: team });
}
