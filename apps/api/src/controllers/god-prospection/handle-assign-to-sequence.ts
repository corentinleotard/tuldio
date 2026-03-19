import type { Request, Response } from 'express';
import { z } from 'zod';
import { assignToSequence } from '@tuldio/core/god-prospection';

const bodySchema = z.object({
  prospectIds: z.array(z.string().uuid()).min(1).max(500),
  sequenceId: z.string().uuid(),
});

export async function handleAssignToSequence(req: Request, res: Response): Promise<void> {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Donnees invalides' } });
    return;
  }

  const result = await assignToSequence(parsed.data);
  res.json({ data: result });
}
