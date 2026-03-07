import type { Request, Response } from 'express';
import { listQuotes } from '@tuldio/core/quotes';
import { getTeamId } from '../middleware/auth.js';

export async function handleListQuotes(_req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const quotes = await listQuotes({ teamId });

  res.json({ data: quotes });
}
