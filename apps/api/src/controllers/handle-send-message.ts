import type { Request, Response } from 'express';
import { processMessage } from '@tuldio/core/ai';
import { getUserId, getTeamId } from '../middleware/auth.js';

export async function handleSendMessage(req: Request, res: Response): Promise<void> {
  const userId = getUserId(res);
  const teamId = getTeamId(res);
  const { content } = req.body;

  const message = await processMessage({ userId, teamId, content });

  res.status(201).json({ data: message });
}
