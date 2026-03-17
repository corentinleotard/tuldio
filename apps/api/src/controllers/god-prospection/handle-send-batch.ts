import type { Request, Response } from 'express';
import { sendBatch } from '@tuldio/core/god-prospection';

export async function handleSendBatch(req: Request, res: Response): Promise<void> {
  const { count, subject, body } = req.body as {
    count: number;
    subject: string;
    body: string;
  };

  if (!subject?.trim() || !body?.trim() || typeof count !== 'number' || count < 1) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'count, subject et body requis' } });
    return;
  }

  const result = await sendBatch({ count, subject, body });
  res.json({ data: result });
}
