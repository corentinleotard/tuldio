import type { Request, Response } from 'express';
import { listSequences } from '@tuldio/core/god-prospection';

export async function handleListSequences(_req: Request, res: Response): Promise<void> {
  const sequences = await listSequences();
  res.json({ data: sequences });
}
