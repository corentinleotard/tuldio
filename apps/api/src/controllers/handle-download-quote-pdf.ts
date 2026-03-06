import type { Request, Response } from 'express';
import { downloadQuotePdf } from '@tuldio/core/quotes';
import { getTeamId } from '../middleware/auth.js';

export async function handleDownloadQuotePdf(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const quoteId = req.params.id as string;

  const result = await downloadQuotePdf({ teamId, quoteId });

  if (result.type === 'file') {
    res.sendFile(result.filePath);
    return;
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
  res.send(result.buffer);
}
