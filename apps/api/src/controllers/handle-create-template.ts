import type { Request, Response } from 'express';
import { createTemplate } from '@tuldio/core/templates';
import { getTeamId } from '../middleware/auth.js';

export async function handleCreateTemplate(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const { type, layoutData, originalUrl } = req.body;

  const template = await createTemplate({ teamId, type, layoutData, originalUrl });

  res.status(201).json({ data: template });
}
