import type { Request, Response } from 'express';
import { getQuote } from '@tuldio/core/quotes';
import { getFilePath } from '@tuldio/core/lib';
import { getTeamId } from '../middleware/auth.js';

export async function handleDownloadQuotePdf(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const quoteId = req.params.id as string;

  const quote = await getQuote({ teamId, quoteId });
  if (!quote.pdfUrl) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'PDF non disponible' } });
    return;
  }

  const filePath = getFilePath(quote.pdfUrl);
  res.sendFile(filePath);
}
