import { query } from '../../../lib/database/db.js';

export interface TeamSubscriptionRow {
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired';
  trial_ends_at: Date | null;
  subscription_period_start: Date | null;
  subscription_period_end: Date | null;
  ai_cost_limit_cents: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export async function findTeamSubscription(input: { teamId: string }): Promise<TeamSubscriptionRow | null> {
  const result = await query<TeamSubscriptionRow>(
    'SELECT subscription_status, trial_ends_at, subscription_period_start, subscription_period_end, ai_cost_limit_cents, stripe_customer_id, stripe_subscription_id FROM teams WHERE id = $1 LIMIT 1',
    [input.teamId],
  );

  return result.rows[0] ?? null;
}
