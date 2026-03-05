import type { Request, Response } from 'express';
import { sendOtp } from '@tuldio/core/auth';

export async function handleSendOtp(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email?: string };

  await sendOtp({ email: email ?? '' });

  res.json({ data: { ok: true } });
}
