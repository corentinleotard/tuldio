import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { deleteQuote } from '../repository/delete-quote.js';

export async function deleteQuoteUc(input: {
  teamId: string;
  quoteId: string;
}): Promise<void> {
  const quote = await findQuoteById({ teamId: input.teamId, quoteId: input.quoteId });
  if (!quote) {
    throw new HandledError(errorCodes.quoteNotFound);
  }

  if (quote.status !== 'draft') {
    throw new HandledError(errorCodes.quoteNotDraft);
  }

  const deleted = await deleteQuote({ teamId: input.teamId, quoteId: input.quoteId });
  if (!deleted) {
    throw new HandledError(errorCodes.quoteNotFound);
  }

  logger.info('quote.deleted', { teamId: input.teamId, quoteId: input.quoteId, number: quote.number });
}
