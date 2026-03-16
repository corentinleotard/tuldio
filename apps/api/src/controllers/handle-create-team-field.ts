import type { Request, Response } from 'express';
import type { CreateTeamFieldRequest } from '@tuldio/common';
import { createTeamField } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleCreateTeamField(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const body = req.body as CreateTeamFieldRequest;

  const field = await createTeamField({ teamId, ...body });
  res.status(201).json({ data: field });
}
