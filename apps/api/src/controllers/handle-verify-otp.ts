import type { Request, Response } from 'express';
import { verifyOtp } from '@tuldio/core/auth';
import { signAccessToken } from '../lib/jwt.js';
import { setAccessCookie, setRefreshCookie } from '../lib/cookies.js';

export async function handleVerifyOtp(req: Request, res: Response): Promise<void> {
  const { email, code } = req.body as { email?: string; code?: string };

  const { auth, refreshToken } = await verifyOtp({
    email: email ?? '',
    code: code ?? '',
  });

  const accessToken = signAccessToken({
    userId: auth.user.id,
    teamId: auth.user.teamId,
  });

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);

  res.json({ data: auth });
}
