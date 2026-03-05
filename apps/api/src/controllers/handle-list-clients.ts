import type { Request, Response } from 'express';
import { listClients } from '@tuldio/core/clients';
import { getTeamId } from '../middleware/auth.js';

export async function handleListClients(_req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const clients = await listClients(teamId);

  res.json({ data: clients });
}
