import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { sendEmail } from '../../../lib/infra/send-email.js';
import { isValidEmail, normalizeEmail, generateOtpCode } from '../domain/validators.js';
import { insertOtp } from '../repository/insert-otp.js';

export async function sendOtp(input: { email: string }): Promise<void> {
  const email = normalizeEmail(input.email);

  if (!isValidEmail(email)) {
    throw new HandledError(errorCodes.emailRequired);
  }

  const code = generateOtpCode();
  await insertOtp({ email, code });

  if (process.env.NODE_ENV !== 'production') {
    logger.info(`[OTP] Dev bypass for ${email} — code: ${code}`);
    return;
  }

  await sendEmail({
    to: email,
    subject: 'Votre code de connexion Tuldio',
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Connexion à Tuldio</h2>
        <p style="color: #555; margin-bottom: 24px;">Voici votre code de vérification :</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
        </div>
        <p style="color: #888; font-size: 13px;">Ce code expire dans 10 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.</p>
      </div>
    `,
  });

  logger.info(`[OTP] Code sent to ${email}`);
}
