import { query } from '../../../lib/database/db.js';
import type { InviteTokenPayload } from '../domain/invite-token.js';

export async function findInviteCode(input: {
  code: string;
}): Promise<{ payload: Omit<InviteTokenPayload, 'exp'>; expiresAt: Date } | null> {
  const { rows } = await query(
    `SELECT payload, expires_at FROM invite_codes WHERE code = $1`,
    [input.code],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    payload: row.payload as Omit<InviteTokenPayload, 'exp'>,
    expiresAt: new Date(row.expires_at),
  };
}
