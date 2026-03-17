import type { Request, Response } from 'express';
import { listProspects } from '@tuldio/core/god-prospection';

export async function handleListProspects(_req: Request, res: Response): Promise<void> {
  const result = await listProspects();
  res.json({ data: result });
}
