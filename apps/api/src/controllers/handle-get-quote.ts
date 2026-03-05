import type { Request, Response } from 'express';
import { getQuote } from '@tuldio/core/quotes';
import { getTeamId } from '../middleware/auth.js';

export async function handleGetQuote(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const quote = await getQuote({ teamId, quoteId: req.params.id as string });

  res.json({ data: quote });
}
