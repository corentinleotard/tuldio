import type { QuoteView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { validateQuoteStatusTransition } from '../domain/validators.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { updateQuoteStatus } from '../repository/update-quote-status.js';
import { updateQuotePdfUrl } from '../repository/update-quote-pdf-url.js';
import { generatePdf } from '../../../lib/pdf/generate-pdf.js';
import { buildDocumentPdfInput } from '../../../lib/pdf/build-document-pdf-input.js';
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

  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    title: row.title,
    lines: toLineViews(current.lines),
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaGroups: toTvaGroups(current.lines),
    status: row.status,
    pdfUrl: pdfUrl ?? row.pdf_url,
    validUntil: row.valid_until?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
