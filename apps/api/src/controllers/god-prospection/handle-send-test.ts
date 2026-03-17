import type { Request, Response } from 'express';
import { sendTestEmail } from '@tuldio/core/god-prospection';

export async function handleSendTest(req: Request, res: Response): Promise<void> {
  const { to, subject, body } = req.body as {
    to: string;
    subject: string;
    body: string;
  };

  if (!to?.trim() || !subject?.trim() || !body?.trim()) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'to, subject et body requis' } });
    return;
  }

  await sendTestEmail({ to, subject, body });
  res.json({ data: { ok: true } });
}
