import type { AuthResponse } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { normalizeEmail, generateRefreshToken } from '../domain/validators.js';
import { findValidOtp } from '../repository/find-valid-otp.js';
import { markOtpUsed } from '../repository/mark-otp-used.js';
import { insertRefreshToken } from '../repository/insert-refresh-token.js';
import { findUserByEmailUc, createUser } from '../../users/index.js';
import { createTeam, getTeam } from '../../teams/index.js';

export async function verifyOtp(input: {
  email: string;
  code: string;
}): Promise<{ auth: AuthResponse; refreshToken: string }> {
  const email = normalizeEmail(input.email);

  // Dev bypass: skip OTP check for dev email
  const isDevBypass =
    process.env.NODE_ENV !== 'production' && email === 'corentin@lempire.co';

  if (!isDevBypass) {
    const otp = await findValidOtp({ email, code: input.code });
    if (!otp) {
      throw new HandledError(errorCodes.invalidOtp);
    }
    await markOtpUsed(otp.id);
  }

  const existingUser = await findUserByEmailUc(email);

  let user;
  let teamId: string;

  if (existingUser) {
    user = {
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      teamId: existingUser.team_id,
      role: existingUser.role,
    };
    teamId = existingUser.team_id;
  } else {
    const team = await createTeam({
      name: 'Mon entreprise',
      siret: '00000000000000',
    });

    user = await createUser({
      teamId: team.id,
      email,
      name: email.split('@')[0] ?? email,
      role: 'owner',
    });
    teamId = team.id;
  }

  const refreshToken = generateRefreshToken();
  await insertRefreshToken({ userId: user.id, token: refreshToken });

  const team = await getTeam(teamId);

  return {
    auth: { user, team },
    refreshToken,
  };
}
