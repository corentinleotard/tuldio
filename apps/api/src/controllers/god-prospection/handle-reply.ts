import type { Request, Response } from 'express';
import { replyToEmail } from '@tuldio/core/god-prospection';

export async function handleReply(req: Request, res: Response): Promise<void> {
  const { to, subject, body, inReplyTo } = req.body as {
    to: string;
    subject: string;
    body: string;
    inReplyTo: string;
  };

  if (!to?.trim() || !subject?.trim() || !body?.trim() || !inReplyTo?.trim()) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'to, subject, body et inReplyTo requis' } });
    return;
  }

  await replyToEmail({ to, subject, body, inReplyTo });
  res.json({ data: { ok: true } });
}
