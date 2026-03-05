import type { Request, Response } from 'express';
import { searchClientsUc } from '@tuldio/core/clients';
import { getTeamId } from '../middleware/auth.js';

export async function handleSearchClients(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const search = (req.query.q as string) ?? '';
  const clients = await searchClientsUc({ teamId, search });

  res.json({ data: clients });
}
