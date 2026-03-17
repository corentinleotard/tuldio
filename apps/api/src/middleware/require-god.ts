import type { Request, Response, NextFunction } from 'express';
import { query } from '@tuldio/core/lib';
import { getUserId } from './auth.js';

export async function requireGod(_req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(res);

  const result = await query<{ god: boolean }>(
    'SELECT god FROM users WHERE id = $1 LIMIT 1',
    [userId],
  );

  const user = result.rows[0];
  if (!user?.god) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'God mode required' } });
    return;
  }

  next();
}
