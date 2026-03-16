import type { QuoteView } from '@tuldio/common';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { getClientDisplayName } from '../../clients/domain/get-client-display-name.js';
import { toLineViews, toTvaGroups } from '../../documents/domain/to-line-views.js';

export async function getQuote(input: {
  teamId: string;
  quoteId: string;
}): Promise<QuoteView> {
  const row = await findQuoteById(input);
  if (!row) {
    throw new HandledError(errorCodes.quoteNotFound);
  }

  const client = await findClientById({ teamId: input.teamId, clientId: row.client_id });

  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: client ? getClientDisplayName(client) : undefined,
    clientEmail: client?.email ?? undefined,
    title: row.title,
    lines: toLineViews(row.lines),
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaGroups: toTvaGroups(row.lines),
    status: row.status,
    pdfUrl: row.pdf_url,
    validUntil: row.valid_until?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    refusedAt: row.refused_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
