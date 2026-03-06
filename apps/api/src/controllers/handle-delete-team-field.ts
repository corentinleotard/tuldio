import type { Request, Response } from 'express';
import { deleteTeamField } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleDeleteTeamField(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const fieldId = req.params.fieldId as string;

  await deleteTeamField({ teamId, fieldId });
  res.status(204).end();
}
