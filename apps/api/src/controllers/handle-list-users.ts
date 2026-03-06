import type { Request, Response } from 'express';
import { listUsers } from '@tuldio/core/users';
import { getUserId } from '../middleware/auth.js';

export async function handleListUsers(_req: Request, res: Response): Promise<void> {
  const godUserId = getUserId(res);
  const users = await listUsers({ godUserId });
  res.json({ data: users });
}
