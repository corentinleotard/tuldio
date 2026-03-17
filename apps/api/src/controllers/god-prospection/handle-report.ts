import type { Request, Response } from 'express';
import { getProspectReport } from '@tuldio/core/god-prospection';

export async function handleReport(_req: Request, res: Response): Promise<void> {
  const report = await getProspectReport();
  res.json({ data: report });
}
