import type { Request, Response } from 'express';
import { listDebugMessages } from '@tuldio/core/messages';
import { getUserId } from '../middleware/auth.js';

export async function handleListDebugMessages(req: Request, res: Response): Promise<void> {
  const godUserId = getUserId(res);
  const targetUserId = req.params.userId as string | undefined;

  if (!targetUserId) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'userId requis' } });
    return;
  }

  const messages = await listDebugMessages({
    godUserId,
    targetUserId,
    limit: 100,
  });

  res.json({ data: messages });
}
