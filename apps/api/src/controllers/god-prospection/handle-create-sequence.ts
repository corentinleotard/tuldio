import type { Request, Response } from 'express';
import { z } from 'zod';
import { createSequence } from '@tuldio/core/god-prospection';

const stepSchema = z.object({
  stepOrder: z.number().int().min(0),
  channel: z.enum(['email', 'whatsapp']),
  delayDays: z.number().int().min(0),
  subject: z.string().nullable(),
  body: z.string().min(1),
  linkText: z.string().nullable().default(null),
});

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  steps: z.array(stepSchema).min(1),
});

export async function handleCreateSequence(req: Request, res: Response): Promise<void> {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Donnees invalides' } });
    return;
  }

  const result = await createSequence(parsed.data);
  res.status(201).json({ data: result });
}
