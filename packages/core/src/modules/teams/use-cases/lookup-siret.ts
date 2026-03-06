import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { lookupSiret } from '../../../lib/infra/sirene-api.js';

export async function lookupSiretUc(siret: string) {
  const cleaned = siret.replace(/\s/g, '');
  if (!/^\d{14}$/.test(cleaned)) {
    throw new HandledError(errorCodes.invalidSiret);
  }

  const result = await lookupSiret(cleaned);
  if (!result) {
    throw new HandledError(errorCodes.invalidSiret);
  }

  return result;
}
