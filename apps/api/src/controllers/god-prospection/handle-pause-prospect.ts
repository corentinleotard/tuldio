import type { Request, Response } from 'express';
import { z } from 'zod';
import { pauseProspectUc } from '@tuldio/core/god-prospection';

const bodySchema = z.object({
  paused: z.boolean(),
});

export async function handlePauseProspect(req: Request, res: Response): Promise<void> {
  const prospectId = req.params.id as string;
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'paused (boolean) requis' } });
    return;
  }

  await pauseProspectUc({ prospectId, paused: parsed.data.paused });
  res.json({ data: { ok: true } });
}
