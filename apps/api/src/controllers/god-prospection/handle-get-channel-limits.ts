import type { Request, Response } from 'express';
import { getChannelLimits } from '@tuldio/core/god-prospection';

export async function handleGetChannelLimits(_req: Request, res: Response): Promise<void> {
  const limits = await getChannelLimits();
  res.json({ data: limits });
}
