import type { Request, Response } from 'express';
import { createCheckoutSession } from '@tuldio/core/subscriptions';
import { getCurrentUser } from '@tuldio/core/users';
import { getTeamId, getUserId } from '../middleware/auth.js';

export async function handleCreateCheckout(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const userId = getUserId(res);
  const user = await getCurrentUser(userId);

  const origin = req.headers.origin || 'http://localhost:5174';
  const { url } = await createCheckoutSession({
    teamId,
    email: user.email ?? '',
    successUrl: `${origin}/settings/subscription?success=true`,
    cancelUrl: `${origin}/settings/subscription?cancelled=true`,
  });

  res.json({ data: { url } });
}
