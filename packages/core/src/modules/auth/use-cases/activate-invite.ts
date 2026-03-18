import type { AuthResponse } from '@tuldio/common';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { decodeInviteToken, hashInviteToken } from '../domain/invite-token.js';
import { findInviteAccount } from '../repository/find-invite-account.js';
import { insertInviteAccount } from '../repository/insert-invite-account.js';
import { findInviteCode } from '../repository/find-invite-code.js';
import { generateRefreshToken } from '../domain/validators.js';
import { insertRefreshToken } from '../repository/insert-refresh-token.js';
import { createUser } from '../../users/index.js';
import { findUserById } from '../../users/repository/find-user-by-id.js';
import { createTeam, getTeam } from '../../teams/index.js';
import { createMessage } from '../../messages/index.js';
import { query } from '../../../lib/database/db.js';
import { getProfessionExample } from '../domain/profession-example.js';

export async function activateInvite(input: {
  token?: string | null;
  code?: string | null;
}): Promise<{ auth: AuthResponse; refreshToken: string }> {
  let payload;
  let tokenHash: string;

  if (input.code) {
    // Short code path (from prospection emails)
    const codeResult = await findInviteCode({ code: input.code });
    if (!codeResult || codeResult.expiresAt < new Date()) {
      throw new HandledError(errorCodes.invalidInviteToken);
    }
    payload = { ...codeResult.payload, exp: Math.floor(codeResult.expiresAt.getTime() / 1000) };
    tokenHash = `code:${input.code}`;
  } else if (input.token) {
    // Legacy JWT path
    const secret = process.env.INVITE_JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('INVITE_JWT_SECRET is required in production');
    }
    try {
      payload = decodeInviteToken({ token: input.token, secret: secret || 'dev-invite-secret-change-in-production' });
    } catch {
      throw new HandledError(errorCodes.invalidInviteToken);
    }
    tokenHash = hashInviteToken({ token: input.token });
  } else {
    throw new HandledError(errorCodes.invalidInviteToken);
  }

  // Check if this token was already used → return existing account
  const existing = await findInviteAccount({ tokenHash });
  if (existing) {
    if (existing.expires_at < new Date()) {
      throw new HandledError(errorCodes.invalidInviteToken);
    }

    const userRow = await findUserById(existing.user_id);
    if (!userRow) {
      throw new HandledError(errorCodes.invalidInviteToken);
    }

    const refreshToken = generateRefreshToken();
    await insertRefreshToken({ userId: userRow.id, token: refreshToken });
    const team = await getTeam(userRow.team_id);

    logger.info('invite.returning_user', { userId: userRow.id, teamId: userRow.team_id });

    return {
      auth: {
        user: {
          id: userRow.id,
          email: userRow.email,
          name: userRow.name,
          teamId: userRow.team_id,
          role: userRow.role,
          god: userRow.god,
        },
        team,
      },
      refreshToken,
    };
  }

  // First activation: create account
  const team = await createTeam({ name: payload.name });

  // Pre-fill team fields with scraped data
  const fieldsToFill: Array<{ key: string; value: string }> = [];
  if (payload.address) fieldsToFill.push({ key: 'address', value: payload.address });
  if (payload.phone) fieldsToFill.push({ key: 'phone', value: payload.phone });
  if (payload.website) fieldsToFill.push({ key: 'website', value: payload.website });

  for (const { key, value } of fieldsToFill) {
    await query(
      `UPDATE team_fields SET value = $3 WHERE team_id = $1 AND key = $2 AND value = ''`,
      [team.id, key, value],
    );
  }

  const userName = payload.firstName || payload.name.split(' ')[0] || 'Utilisateur';

  const user = await createUser({
    teamId: team.id,
    email: null,
    name: userName,
    role: 'owner',
  });

  // Store invite account mapping
  const expiresAt = new Date(payload.exp * 1000);
  await insertInviteAccount({ tokenHash, userId: user.id, expiresAt });

  // Create personalized welcome message with profession-specific example
  const example = getProfessionExample({ profession: payload.profession });

  const welcomeMessage = [
    `**Bienvenue ${userName} !** 👋`,
    '',
    "Je suis ton assistant administratif. J'ai déjà récupéré les infos de ton entreprise,tu peux créer ton premier devis tout de suite.",
    '',
    'Par exemple, essaie :',
    '',
    `> « ${example} »`,
    '',
    "Je m'occupe du devis, du PDF, et je peux l'envoyer par email,tout ça depuis cette conversation.",
    '',
    "**Qu'est-ce que je peux faire pour toi ?**",
  ].join('\n');

  await createMessage({
    userId: user.id,
    teamId: team.id,
    role: 'assistant',
    content: welcomeMessage,
  });

  const refreshToken = generateRefreshToken();
  await insertRefreshToken({ userId: user.id, token: refreshToken });

  // Refetch team with seeded fields
  const fullTeam = await getTeam(team.id);

  logger.info('invite.new_user', { userId: user.id, teamId: team.id, profession: payload.profession });

  return {
    auth: { user, team: fullTeam },
    refreshToken,
  };
}
