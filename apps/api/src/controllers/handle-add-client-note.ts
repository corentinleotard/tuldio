import type { Request, Response } from 'express';
import { addClientNote } from '@tuldio/core/clients';
import { getTeamId } from '../middleware/auth.js';

export async function handleAddClientNote(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const clientId = req.params.id as string;
  const { content } = req.body as { content: string };
  await addClientNote({ teamId, clientId, content });

  res.status(204).end();
}
