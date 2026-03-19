import type { Request, Response } from 'express';
import { z } from 'zod';
import { updateProspectFields, findProspectById } from '@tuldio/core/god-prospection';

const bodySchema = z.object({
  firstName: z.string().optional(),
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  whatsappPhone: z.string().nullable().optional(),
  profession: z.string().min(1).optional(),
  website: z.string().nullable().optional(),
});

export async function handleUpdateProspect(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Donnees invalides' } });
    return;
  }

  await updateProspectFields({ id, ...parsed.data });
  const prospect = await findProspectById({ id });
  res.json({ data: prospect });
}
