import type { QuoteView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { toLineViews, toTvaGroups } from '../../shared/domain/to-line-views.js';

export async function getQuote(input: {
  teamId: string;
  quoteId: string;
}): Promise<QuoteView> {
  const row = await findQuoteById(input);
  if (!row) {
    throw new HandledError(errorCodes.quoteNotFound);
  }

  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    title: row.title,
    lines: toLineViews(row.lines),
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaGroups: toTvaGroups(row.lines),
    status: row.status,
    pdfUrl: row.pdf_url,
    validUntil: row.valid_until?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
