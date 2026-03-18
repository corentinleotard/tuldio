import type { Request, Response } from 'express';
import { sendBatch } from '@tuldio/core/god-prospection';

export async function handleSendBatch(req: Request, res: Response): Promise<void> {
  const { count, body, profession } = req.body as {
    count: number;
    body: string;
    profession?: string;
  };

  if (!body?.trim() || typeof count !== 'number' || count < 1) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'count et body requis' } });
    return;
  }

  const result = await sendBatch({ count, body, profession: profession?.trim() || null });
  res.json({ data: result });
}
