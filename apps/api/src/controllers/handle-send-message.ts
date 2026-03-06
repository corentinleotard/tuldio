import type { Request, Response } from 'express';
import { processMessage } from '@tuldio/core/ai';
import { getUserId, getTeamId } from '../middleware/auth.js';

const MAX_MESSAGE_LENGTH = 5000;

export async function handleSendMessage(req: Request, res: Response): Promise<void> {
  const userId = getUserId(res);
  const teamId = getTeamId(res);
  const { content, metadata } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: { code: 'INVALID_MESSAGE', message: 'Message requis' } });
    return;
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: { code: 'MESSAGE_TOO_LONG', message: 'Message trop long (5000 caractères max)' } });
    return;
  }

  const message = await processMessage({
    userId,
    teamId,
    content: content.trim(),
    metadata: metadata ?? undefined,
  });

  res.status(201).json({ data: message });
}
