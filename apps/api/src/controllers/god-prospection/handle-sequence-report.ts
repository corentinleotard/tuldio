import type { Request, Response } from 'express';
import { getSequenceReport } from '@tuldio/core/god-prospection';

export async function handleSequenceReport(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const report = await getSequenceReport({ sequenceId: id });
  res.json({ data: report });
}
