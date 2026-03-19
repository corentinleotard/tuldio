import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  sendWhatsAppMessage,
  normalizePhoneToInternational,
  buildMessageText,
} from '@tuldio/core/god-prospection';

const bodySchema = z.object({
  phone: z.string().min(1),
  body: z.string().min(1),
  firstName: z.string().default(''),
  profession: z.string().default('Osteopathe'),
});

export async function handleSendTestWhatsApp(req: Request, res: Response): Promise<void> {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'phone et body requis' } });
    return;
  }

  const phone = normalizePhoneToInternational({ phone: parsed.data.phone });
  const text = buildMessageText({
    template: parsed.data.body,
    prospect: { firstName: parsed.data.firstName, fullName: 'Test', profession: parsed.data.profession },
    inviteUrl: null,
  });

  await sendWhatsAppMessage({ phone, text });
  res.json({ data: { sent: true, phone } });
}
