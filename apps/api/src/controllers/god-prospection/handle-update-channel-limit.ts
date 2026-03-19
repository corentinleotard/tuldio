import type { Request, Response } from 'express';
import { z } from 'zod';
import { updateChannelLimitsUc } from '@tuldio/core/god-prospection';

const ALLOWED_CHANNELS = ['email', 'whatsapp'] as const;

const bodySchema = z.object({
  dailyLimit: z.number().int().min(0).max(1000),
});

export async function handleUpdateChannelLimit(req: Request, res: Response): Promise<void> {
  const channel = req.params.channel as string;
  if (!ALLOWED_CHANNELS.includes(channel as typeof ALLOWED_CHANNELS[number])) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Canal invalide' } });
    return;
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'dailyLimit invalide' } });
    return;
  }

  await updateChannelLimitsUc({ channel, dailyLimit: parsed.data.dailyLimit });
  res.json({ data: { ok: true } });
}
