import { query } from '../../../lib/database/db.js';

export async function insertInviteAccount(input: {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}): Promise<void> {
  await query(
    `INSERT INTO invite_accounts (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_hash) DO NOTHING`,
    [input.tokenHash, input.userId, input.expiresAt],
  );
}
