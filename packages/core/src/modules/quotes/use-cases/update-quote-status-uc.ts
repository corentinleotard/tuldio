import type { QuoteView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { validateStatusTransition } from '../domain/validators.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { updateQuoteStatus } from '../repository/update-quote-status.js';

export async function updateQuoteStatusUc(input: {
  teamId: string;
  quoteId: string;
  status: string;
}): Promise<QuoteView> {
  const current = await findQuoteById({
    teamId: input.teamId,
    quoteId: input.quoteId,
  });
  if (!current) {
    throw new HandledError(errorCodes.quoteNotFound);
  }

  const isValid = validateStatusTransition({
    from: current.status,
    to: input.status,
  });
  if (!isValid) {
    throw new HandledError(errorCodes.invalidStatusTransition);
  }

  const row = await updateQuoteStatus(input);

  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    lines: row.lines,
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaRate: row.tva_rate,
    status: row.status,
    pdfUrl: row.pdf_url,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
