import type { Request, Response } from 'express';
import { listSentEmails } from '@tuldio/core/god-prospection';

export async function handleListSent(req: Request, res: Response): Promise<void> {
  const limit = Number(req.query.limit || '40');
  const offset = Number(req.query.offset || '0');

  const result = await listSentEmails({ limit, offset });
  res.json({ data: result });
}
