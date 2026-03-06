import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';

export function validateTeamName(name: string): void {
  if (name.trim().length === 0) {
    throw new HandledError(errorCodes.nameRequired);
  }
  if (name.length > 200) {
    throw new HandledError(errorCodes.nameTooLong);
  }
}
