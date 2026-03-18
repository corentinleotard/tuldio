import type { InviteTokenPayload } from '../domain/invite-token.js';
import { findInviteCode } from '../repository/find-invite-code.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';

export async function resolveInviteCode(input: {
  code: string;
}): Promise<Omit<InviteTokenPayload, 'exp'>> {
  const result = await findInviteCode({ code: input.code });

  if (!result) {
    throw new HandledError(errorCodes.invalidInviteToken);
  }

  if (result.expiresAt < new Date()) {
    throw new HandledError(errorCodes.invalidInviteToken);
  }

  return result.payload;
}
