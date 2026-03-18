import type { Request, Response } from 'express';
import { cancelBatch } from '@tuldio/core/god-prospection';

export async function handleCancelBatch(_req: Request, res: Response): Promise<void> {
  const result = cancelBatch();
  res.json({ data: result });
}
