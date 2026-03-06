import type { Request, Response } from 'express';
import { updateClientUc } from '@tuldio/core/clients';
import { getTeamId } from '../middleware/auth.js';

export async function handleUpdateClient(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const clientId = req.params.id as string;
  const { firstName, lastName, email, phone, address } = req.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  const client = await updateClientUc({ teamId, clientId, firstName, lastName, email, phone, address });

  res.json({ data: client });
}
