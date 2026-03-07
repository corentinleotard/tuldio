import type { AuthResponse } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { normalizeEmail, generateRefreshToken } from '../domain/validators.js';
import { findValidOtp } from '../repository/find-valid-otp.js';
import { markOtpUsed } from '../repository/mark-otp-used.js';
import { insertRefreshToken } from '../repository/insert-refresh-token.js';
import { findUserByEmailUc, createUser } from '../../users/index.js';
import { createTeam, getTeam } from '../../teams/index.js';
import { createMessage } from '../../messages/index.js';

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
      god: existingUser.god,
    };
    teamId = existingUser.team_id;
  } else {
    const team = await createTeam({
      name: 'Mon entreprise',
    });

    user = await createUser({
      teamId: team.id,
      email,
      name: email.split('@')[0] ?? email,
      role: 'owner',
    });
    teamId = team.id;

    const welcomeMessage = [
      '**Bienvenue sur Tuldio !** 👋',
      '',
      'Je suis ton assistant administratif. Dis-moi ce dont tu as besoin, comme tu le dirais à un collègue.',
      '',
      'Par exemple, essaie :',
      '',
      '> « Fais un devis pour Jean Martin, pose de carrelage 35m² à 55€/m² »',
      '',
      "Je m'occupe du devis, du PDF, et je peux l'envoyer par email — tout ça depuis cette conversation.",
      '',
      'Quelques idées de ce que je sais faire :',
      '- **Devis & factures** — "Fais un devis…", "Facture le devis de Martin"',
      '- **Clients** — "Ajoute un client Dupont, 06 12 34 56 78"',
      '- **Stats** — "Combien j\'ai facturé ce mois-ci ?"',
      '',
      "**Qu'est-ce que je peux faire pour toi ?**",
    ].join('\n');

    await createMessage({
      userId: user.id,
      teamId: team.id,
      role: 'assistant',
      content: welcomeMessage,
    });
  }

  const refreshToken = generateRefreshToken();
  await insertRefreshToken({ userId: user.id, token: refreshToken });

  const team = await getTeam(teamId);

  return {
    auth: { user, team },
    refreshToken,
  };
}
