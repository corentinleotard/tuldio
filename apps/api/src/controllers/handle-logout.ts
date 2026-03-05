import type { Request, Response } from 'express';
import { logout } from '@tuldio/core/auth';
import { clearAuthCookies } from '../lib/cookies.js';

export async function handleLogout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.tuldio_refresh;

  if (token) {
    await logout({ token });
  }

  clearAuthCookies(res);
  res.json({ data: { ok: true } });
}
