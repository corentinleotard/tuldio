import type { Request, Response } from 'express';
import { createQuote } from '@tuldio/core/quotes';
import { getUserId, getTeamId } from '../middleware/auth.js';

export async function handleCreateQuote(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const userId = getUserId(res);
  const { clientId, lines, tvaRate } = req.body;

  const quote = await createQuote({ teamId, userId, clientId, lines, tvaRate });

  res.status(201).json({ data: quote });
}
