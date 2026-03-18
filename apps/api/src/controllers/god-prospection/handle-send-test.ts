import type { Request, Response } from 'express';
import { sendTestEmail } from '@tuldio/core/god-prospection';

export async function handleSendTest(req: Request, res: Response): Promise<void> {
  const { to, body, profession } = req.body as {
    to: string;
    body: string;
    profession?: string;
  };

  if (!to?.trim() || !body?.trim()) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'to et body requis' } });
    return;
  }

  await sendTestEmail({ to, body, profession: profession?.trim() || 'Ostéopathe' });
  res.json({ data: { ok: true } });
}
