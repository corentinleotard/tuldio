import type { Request, Response } from 'express';
import { findSendQueue } from '@tuldio/core/god-prospection';

export async function handleSendQueue(req: Request, res: Response): Promise<void> {
  const profession = typeof req.query.profession === 'string' ? req.query.profession.trim() || null : null;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const prospects = await findSendQueue({ profession, limit });
  res.json({ data: prospects });
}
