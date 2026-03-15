import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamSubscription } from '../repository/find-team-subscription.js';
import { getBillingCycleCost } from '../repository/get-billing-cycle-cost.js';

export async function checkAiLimit(input: { teamId: string }): Promise<void> {
  const sub = await findTeamSubscription({ teamId: input.teamId });
  if (!sub) return;

  let periodStart: Date | null;
  let periodEnd: Date | null;

  if (sub.subscription_period_start && sub.subscription_period_end) {
    // Active subscription — use Stripe billing period
    periodStart = sub.subscription_period_start;
    periodEnd = sub.subscription_period_end;
  } else if (sub.trial_ends_at) {
    // Trial — use trial window (trial_ends_at - 14 days to trial_ends_at)
    periodStart = new Date(sub.trial_ends_at.getTime() - 14 * 24 * 60 * 60 * 1000);
    periodEnd = sub.trial_ends_at;
  } else {
    // No period info — skip check
    return;
  }

  const currentCost = await getBillingCycleCost({
    teamId: input.teamId,
    periodStart,
    periodEnd,
  });

  if (currentCost >= sub.ai_cost_limit_cents) {
    throw new HandledError(errorCodes.aiLimitReached);
  }
}
