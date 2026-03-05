import type { Request, Response } from 'express';
import { updateQuoteStatusUc } from '@tuldio/core/quotes';
import { getTeamId } from '../middleware/auth.js';

export async function handleUpdateQuoteStatus(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const quote = await updateQuoteStatusUc({ teamId, quoteId: req.params.id as string, status: req.body.status });

  res.json({ data: quote });
}
