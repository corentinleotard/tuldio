import type { Request, Response } from 'express';
import { deleteLogo } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleDeleteLogo(_req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  await deleteLogo({ teamId });
  res.status(204).end();
}
