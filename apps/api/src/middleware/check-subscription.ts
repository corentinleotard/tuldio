import type { Request, Response, NextFunction } from 'express';
import { findTeamSubscription } from '@tuldio/core/subscriptions';
import { HandledError, errorCodes } from '@tuldio/core/lib';

export function checkSubscription(req: Request, res: Response, next: NextFunction) {
  // Allow all GET requests (read-only mode)
  if (req.method === 'GET') {
    next();
    return;
  }

  // teamId is set by authMiddleware (runs before this at app level).
  const teamId = res.locals.teamId as string | undefined;
  if (!teamId) {
    next();
    return;
  }

  findTeamSubscription({ teamId })
    .then((sub) => {
      if (!sub) {
        next(new HandledError(errorCodes.subscriptionInactive));
        return;
      }

      if (sub.subscription_status === 'expired' || sub.subscription_status === 'cancelled') {
        next(new HandledError(errorCodes.subscriptionInactive));
        return;
      }

      next();
    })
    .catch(next);
}
