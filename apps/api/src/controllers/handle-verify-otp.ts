import type { Request, Response } from 'express';
import { verifyOtp } from '@tuldio/core/auth';
import { signAccessToken, verifyAccessToken } from '../lib/jwt.js';
import { setAccessCookie, setRefreshCookie } from '../lib/cookies.js';

export async function handleVerifyOtp(req: Request, res: Response): Promise<void> {
  const { email, code } = req.body as { email?: string; code?: string };

  // If the user is already authenticated (token flow), attach email to their account
  let attachToUserId: string | undefined;
  const accessCookie = req.cookies?.tuldio_access as string | undefined;
  if (accessCookie) {
    try {
      const payload = verifyAccessToken(accessCookie);
      attachToUserId = payload.userId;
    } catch {
      // Invalid/expired token — proceed with normal flow
    }
  }

  const { auth, refreshToken } = await verifyOtp({
    email: email ?? '',
    code: code ?? '',
    attachToUserId,
  });

  const accessToken = signAccessToken({
    userId: auth.user.id,
    teamId: auth.user.teamId,
  });

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);

  res.json({ data: auth });
}
