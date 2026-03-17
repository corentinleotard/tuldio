import type { Request, Response } from 'express';
import { getBatchStatus } from '@tuldio/core/god-prospection';

export async function handleBatchStatus(_req: Request, res: Response): Promise<void> {
  const status = getBatchStatus();
  res.json({ data: status });
}
