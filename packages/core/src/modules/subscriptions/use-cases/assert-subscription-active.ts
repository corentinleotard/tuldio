import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamSubscription } from '../repository/find-team-subscription.js';

export async function assertSubscriptionActive(input: { teamId: string }): Promise<void> {
  const sub = await findTeamSubscription({ teamId: input.teamId });

  if (!sub) {
    throw new HandledError(errorCodes.subscriptionInactive);
  }

  if (sub.subscription_status === 'expired' || sub.subscription_status === 'cancelled') {
    throw new HandledError(errorCodes.subscriptionInactive);
  }
}
