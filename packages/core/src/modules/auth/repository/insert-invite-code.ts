import crypto from 'node:crypto';
import { query } from '../../../lib/database/db.js';
import type { InviteTokenPayload } from '../domain/invite-token.js';

const MAX_RETRIES = 3;

/** Generate a short code, insert it, and return the code. Retries on collision. */
export async function insertInviteCode(input: {
  payload: Omit<InviteTokenPayload, 'exp'>;
  expiresAt: Date;
}): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = crypto.randomBytes(8).toString('base64url'); // ~11 chars, 64 bits of entropy
    const { rowCount } = await query(
      `INSERT INTO invite_codes (code, payload, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO NOTHING`,
      [code, JSON.stringify(input.payload), input.expiresAt],
    );

    if (rowCount && rowCount > 0) {
      return code;
    }
  }

  throw new Error('Failed to generate unique invite code after retries');
}
