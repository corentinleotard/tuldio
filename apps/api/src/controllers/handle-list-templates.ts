import type { Request, Response } from 'express';
import { listTemplates } from '@tuldio/core/templates';
import { getTeamId } from '../middleware/auth.js';

export async function handleListTemplates(_req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);

  const templates = await listTemplates(teamId);

  res.json({ data: templates });
}
