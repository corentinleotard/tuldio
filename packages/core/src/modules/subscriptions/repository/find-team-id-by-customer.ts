import { query } from '../../../lib/database/db.js';

export async function findTeamIdByCustomer(input: { stripeCustomerId: string }): Promise<string | null> {
  const result = await query<{ id: string }>(
    'SELECT id FROM teams WHERE stripe_customer_id = $1 LIMIT 1',
    [input.stripeCustomerId],
  );

  return result.rows[0]?.id ?? null;
}
