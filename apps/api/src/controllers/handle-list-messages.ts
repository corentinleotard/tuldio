import type { Request, Response } from 'express';
import { listMessages } from '@tuldio/core/messages';
import { getUserId } from '../middleware/auth.js';

export async function handleListMessages(req: Request, res: Response): Promise<void> {
  const userId = getUserId(res);
  const cursor = req.query.cursor as string | undefined;

  const messages = await listMessages({ userId, cursor });

  res.json({ data: messages });
}
