import type { Request, Response } from 'express';
import { refreshTokens } from '@tuldio/core/auth';
import { signAccessToken } from '../lib/jwt.js';
import { setAccessCookie, setRefreshCookie } from '../lib/cookies.js';

export async function handleRefresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.tuldio_refresh;

  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Session expirée' } });
    return;
  }

  const { userId, teamId, newRefreshToken } = await refreshTokens({ token });

  const accessToken = signAccessToken({ userId, teamId });

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, newRefreshToken);

  res.json({ data: { ok: true } });
}
