import type { Request, Response } from 'express';
import { sendDocumentEmail } from '@tuldio/core/documents';
import { getTeamId } from '../middleware/auth.js';

export async function handleSendQuoteEmail(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const baseUrl = process.env.APP_URL ?? `${req.protocol}://${req.get('host')}`;

  const result = await sendDocumentEmail({
    teamId,
    documentType: 'quote',
    documentId: req.params.id as string,
    baseUrl,
  });

  res.json({ data: result });
}
