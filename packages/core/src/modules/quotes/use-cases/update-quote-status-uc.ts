import type { QuoteView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { validateQuoteStatusTransition } from '../domain/validators.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { updateQuoteStatus } from '../repository/update-quote-status.js';
import { updateQuotePdfUrl } from '../repository/update-quote-pdf-url.js';
import { generatePdf } from '../../../lib/pdf/generate-pdf.js';
import { buildDocumentPdfInput } from '../../../lib/pdf/build-document-pdf-input.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { toLineViews, toTvaGroups } from '../../shared/domain/to-line-views.js';

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

  const isValid = validateQuoteStatusTransition({
    from: current.status,
    to: input.status,
  });
  if (!isValid) {
    throw new HandledError(errorCodes.invalidStatusTransition);
  }

  // Freeze PDF when transitioning to sent
  let pdfUrl = current.pdf_url;
  if (input.status === 'sent' && !pdfUrl) {
    const lineViews = toLineViews(current.lines);
    const tvaGroups = toTvaGroups(current.lines);
    const pdfInput = await buildDocumentPdfInput({
      type: 'quote',
      teamId: input.teamId,
      id: current.id,
      number: current.number,
      clientId: current.client_id,
      lines: lineViews,
      totalHt: current.total_ht,
      totalTtc: current.total_ttc,
      tvaGroups,
      createdAt: current.created_at,
      validUntil: current.valid_until,
    });
    pdfUrl = await generatePdf(pdfInput);
    await updateQuotePdfUrl({ teamId: input.teamId, quoteId: current.id, pdfUrl });
  }

  const row = await updateQuoteStatus(input);
  const client = await findClientById({ teamId: input.teamId, clientId: row.client_id });

  logger.info('quote.status_changed', { teamId: input.teamId, quoteId: input.quoteId, from: current.status, to: input.status });

  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: client ? `${client.first_name} ${client.last_name}` : undefined,
    clientEmail: client?.email ?? undefined,
    title: row.title,
    lines: toLineViews(current.lines),
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaGroups: toTvaGroups(current.lines),
    status: row.status,
    pdfUrl: pdfUrl ?? row.pdf_url,
    validUntil: row.valid_until?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    refusedAt: row.refused_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
