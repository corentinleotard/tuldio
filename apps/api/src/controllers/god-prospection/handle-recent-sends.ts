import type { Request, Response } from 'express';
import { findRecentSends } from '@tuldio/core/god-prospection';

export async function handleRecentSends(req: Request, res: Response): Promise<void> {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const channel = typeof req.query.channel === 'string' ? req.query.channel : null;
  const sends = await findRecentSends({ channel, limit });
  res.json({ data: sends });
}
