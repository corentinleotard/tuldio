import type { Request, Response } from 'express';
import { z } from 'zod';
import { updateSequenceUc } from '@tuldio/core/god-prospection';

const stepSchema = z.object({
  stepOrder: z.number().int().min(0),
  channel: z.enum(['email', 'whatsapp']),
  delayDays: z.number().int().min(0),
  subject: z.string().nullable(),
  body: z.string().min(1),
});

const bodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
  steps: z.array(stepSchema).min(1).optional(),
});

export async function handleUpdateSequence(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Donnees invalides' } });
    return;
  }

  await updateSequenceUc({ id, ...parsed.data });
  res.json({ data: { ok: true } });
}
