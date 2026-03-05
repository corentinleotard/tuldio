import { query } from '../../../lib/database/db.js';

export async function revokeRefreshToken(token: string): Promise<void> {
  await query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [token]);
}
