import type { Request, Response } from 'express';
import { getCurrentUser } from '@tuldio/core/users';
import { getUserId } from '../middleware/auth.js';

export async function handleMe(_req: Request, res: Response): Promise<void> {
  const userId = getUserId(res);
  const user = await getCurrentUser(userId);

  res.json({ data: { user } });
}
