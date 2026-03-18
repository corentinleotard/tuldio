import type { Request, Response } from 'express';
import { resolveInviteCode } from '@tuldio/core/auth';

export async function handleResolveInviteCode(req: Request, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  const payload = await resolveInviteCode({ code });
  res.json({ data: payload });
}
