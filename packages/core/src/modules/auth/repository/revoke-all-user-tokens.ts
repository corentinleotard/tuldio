import { query } from '../../../lib/database/db.js';

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [userId]);
}
