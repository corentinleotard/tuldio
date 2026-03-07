import { query } from '../../../lib/database/db.js';
import type { RefreshTokenRow } from '../domain/refresh-token.entity.js';
import { hashToken } from '../domain/validators.js';

export async function findRefreshToken(token: string): Promise<RefreshTokenRow | null> {
  const result = await query<RefreshTokenRow>(
    `SELECT id, user_id, token, expires_at, revoked, created_at FROM refresh_tokens
     WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()
     LIMIT 1`,
    [hashToken(token)],
  );

  return result.rows[0] ?? null;
}
