import type { Request, Response } from 'express';
import type { CreateClientRequest } from '@tuldio/types';
import { createClient } from '@tuldio/core/clients';
import { getTeamId } from '../middleware/auth.js';

export async function handleCreateClient(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const body = req.body as CreateClientRequest;
  const client = await createClient({ teamId, ...body });

  res.status(201).json({ data: client });
}
