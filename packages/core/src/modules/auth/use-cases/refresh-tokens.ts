import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { generateRefreshToken } from '../domain/validators.js';
import { findRefreshToken } from '../repository/find-refresh-token.js';
import { revokeRefreshToken } from '../repository/revoke-refresh-token.js';
import { insertRefreshToken } from '../repository/insert-refresh-token.js';
import { findUserByIdRepo } from '../repository/find-user-by-id-for-auth.js';

export async function refreshTokens(input: {
  token: string;
}): Promise<{ userId: string; teamId: string; newRefreshToken: string }> {
  const existing = await findRefreshToken(input.token);
  if (!existing) {
    throw new HandledError(errorCodes.invalidRefreshToken);
  }

  await revokeRefreshToken(input.token);

  const newRefreshToken = generateRefreshToken();
  await insertRefreshToken({ userId: existing.user_id, token: newRefreshToken });

  const user = await findUserByIdRepo(existing.user_id);
  if (!user) {
    throw new HandledError(errorCodes.userNotFound);
  }

  return {
    userId: existing.user_id,
    teamId: user.team_id,
    newRefreshToken,
  };
}
