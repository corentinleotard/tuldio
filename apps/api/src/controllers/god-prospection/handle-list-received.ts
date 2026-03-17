import type { Request, Response } from 'express';
import { listReceivedEmails } from '@tuldio/core/god-prospection';

export async function handleListReceived(req: Request, res: Response): Promise<void> {
  const limit = Number(req.query.limit || '50');
  const olderThan = typeof req.query.olderThan === 'string' ? req.query.olderThan : null;

  const emails = await listReceivedEmails({ limit, olderThan });
  res.json({ data: emails });
}
