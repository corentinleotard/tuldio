import type { Request, Response } from 'express';
import { findSequenceProspects } from '@tuldio/core/god-prospection';

export async function handleSequenceProspects(req: Request, res: Response): Promise<void> {
  const sequenceId = req.params.id as string;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const step = req.query.step !== undefined ? Number(req.query.step) : undefined;
  const prospects = await findSequenceProspects({ sequenceId, step, limit });
  res.json({ data: prospects });
}
