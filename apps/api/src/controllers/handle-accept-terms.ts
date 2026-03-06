import type { Request, Response } from 'express';
import { acceptTerms } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleAcceptTerms(_req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const team = await acceptTerms({ teamId });
  res.json({ data: team });
}
