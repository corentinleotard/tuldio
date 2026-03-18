import type { Request, Response } from 'express';
import { activateInvite } from '@tuldio/core/auth';
import { signAccessToken } from '../lib/jwt.js';
import { setAccessCookie, setRefreshCookie } from '../lib/cookies.js';

export async function handleActivateInvite(req: Request, res: Response): Promise<void> {
  const { token, code } = req.body as { token?: string; code?: string };

  const { auth, refreshToken } = await activateInvite({
    token: token ?? null,
    code: code ?? null,
  });

  const accessToken = signAccessToken({
    userId: auth.user.id,
    teamId: auth.user.teamId,
  });

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);

  res.json({ data: auth });
}
