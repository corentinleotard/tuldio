import type { Request, Response } from 'express';
import { getAiCosts } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleGetAiCosts(_req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const costs = await getAiCosts({ teamId });
  res.json({ data: costs });
}
