import type { Request, Response } from 'express';
import { findProspectById } from '@tuldio/core/god-prospection';

export async function handleGetProspect(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const prospect = await findProspectById({ id });
  if (!prospect) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prospect introuvable' } });
    return;
  }
  res.json({ data: prospect });
}
