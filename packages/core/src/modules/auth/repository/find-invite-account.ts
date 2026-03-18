import { query } from '../../../lib/database/db.js';

interface InviteAccountRow {
  user_id: string;
  expires_at: Date;
}

export async function findInviteAccount(input: { tokenHash: string }): Promise<InviteAccountRow | null> {
  const result = await query<InviteAccountRow>(
    'SELECT user_id, expires_at FROM invite_accounts WHERE token_hash = $1 LIMIT 1',
    [input.tokenHash],
  );

  return result.rows[0] ?? null;
}
