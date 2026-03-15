import { query } from '../../../lib/database/db.js';

export async function updateSubscriptionStatus(input: {
  teamId: string;
  subscriptionStatus: 'trial' | 'active' | 'cancelled' | 'expired';
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionPeriodStart?: Date | null;
  subscriptionPeriodEnd?: Date | null;
}): Promise<void> {
  const sets: string[] = ['subscription_status = $2'];
  const params: unknown[] = [input.teamId, input.subscriptionStatus];
  let paramIndex = 3;

  if (input.stripeCustomerId !== undefined) {
    sets.push(`stripe_customer_id = $${paramIndex}`);
    params.push(input.stripeCustomerId);
    paramIndex++;
  }

  if (input.stripeSubscriptionId !== undefined) {
    sets.push(`stripe_subscription_id = $${paramIndex}`);
    params.push(input.stripeSubscriptionId);
    paramIndex++;
  }

  if (input.subscriptionPeriodStart !== undefined) {
    sets.push(`subscription_period_start = $${paramIndex}`);
    params.push(input.subscriptionPeriodStart);
    paramIndex++;
  }

  if (input.subscriptionPeriodEnd !== undefined) {
    sets.push(`subscription_period_end = $${paramIndex}`);
    params.push(input.subscriptionPeriodEnd);
    paramIndex++;
  }

  await query(
    `UPDATE teams SET ${sets.join(', ')} WHERE id = $1`,
    params,
  );
}
