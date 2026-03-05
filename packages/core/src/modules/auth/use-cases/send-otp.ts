import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { isValidEmail, normalizeEmail, generateOtpCode } from '../domain/validators.js';
import { insertOtp } from '../repository/insert-otp.js';

export async function sendOtp(input: { email: string }): Promise<void> {
  const email = normalizeEmail(input.email);

  if (!isValidEmail(email)) {
    throw new HandledError(errorCodes.emailRequired);
  }

  // Dev bypass: skip DB insert for dev email
  if (process.env.NODE_ENV !== 'production' && email === 'corentin@lempire.co') {
    logger.info(`[OTP] Dev bypass for ${email} — use any code`);
    return;
  }

  const code = generateOtpCode();
  await insertOtp({ email, code });

  // TODO: Send via Resend in production
  logger.info(`[OTP] Code for ${email}: ${code}`);
}
