import type { Request, Response } from 'express';
import { findProspectsDueForStep } from '@tuldio/core/god-prospection';

export async function handleUpcomingSends(req: Request, res: Response): Promise<void> {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const prospects = await findProspectsDueForStep({ channel: null, dueWithinHours: 24, limit });
  res.json({ data: prospects });
}
