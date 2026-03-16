import type { Request, Response } from 'express';
import { deleteQuoteUc } from '@tuldio/core/quotes';
import { getTeamId } from '../middleware/auth.js';

export async function handleDeleteQuote(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  await deleteQuoteUc({ teamId, quoteId: req.params.id as string });
  res.status(204).end();
}
