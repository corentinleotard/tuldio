import type { Request, Response } from 'express';
import { getClient } from '@tuldio/core/clients';
import { getTeamId } from '../middleware/auth.js';

export async function handleGetClient(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const clientId = req.params.id as string;
  const client = await getClient({ teamId, clientId });

  res.json({ data: client });
}
