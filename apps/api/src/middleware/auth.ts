import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.tuldio_access;

  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentification requise' } });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    res.locals.userId = payload.userId;
    res.locals.teamId = payload.teamId;
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentification requise' } });
  }
}

export function getUserId(res: Response): string {
  return res.locals.userId as string;
}

export function getTeamId(res: Response): string {
  return res.locals.teamId as string;
}
