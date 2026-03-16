import type { Request, Response } from 'express';
import type { UpdateTeamFieldRequest } from '@tuldio/common';
import { updateTeamField } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleUpdateTeamField(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const fieldId = req.params.fieldId as string;
  const body = req.body as UpdateTeamFieldRequest;

  const field = await updateTeamField({ teamId, fieldId, ...body });
  res.json({ data: field });
}
