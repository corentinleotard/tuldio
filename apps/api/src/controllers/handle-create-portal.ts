import type { Request, Response } from 'express';
import { createCustomerPortal } from '@tuldio/core/subscriptions';
import { getTeamId } from '../middleware/auth.js';

export async function handleCreatePortal(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);

  const origin = req.headers.origin || 'http://localhost:5174';
  const { url } = await createCustomerPortal({
    teamId,
    returnUrl: `${origin}/settings/subscription`,
  });

  res.json({ data: { url } });
}
