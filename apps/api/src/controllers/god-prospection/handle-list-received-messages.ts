import type { Request, Response } from 'express';
import { listReceivedMessages } from '@tuldio/core/god-prospection';

export async function handleListReceivedMessages(req: Request, res: Response): Promise<void> {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const olderThan = typeof req.query.olderThan === 'string' ? req.query.olderThan : null;
  const channel = (req.query.channel as string) || 'all';

  if (!['all', 'email', 'whatsapp'].includes(channel)) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Canal invalide' } });
    return;
  }

  const messages = await listReceivedMessages({
    channel: channel as 'all' | 'email' | 'whatsapp',
    limit,
    olderThan,
  });
  res.json({ data: messages });
}
