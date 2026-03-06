import type { InvoiceView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findQuoteById } from '../../quotes/repository/find-quote-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { findTeamFields } from '../../teams/repository/find-team-fields.js';
import { toTeamField } from '../../teams/domain/team-field.view.js';
import { insertInvoice } from '../repository/insert-invoice.js';
import { updateInvoicePdfUrl } from '../repository/update-invoice-pdf-url.js';
import { generatePdf } from '../../../lib/pdf/generate-pdf.js';
import { logger } from '../../../lib/infra/logger.js';

export async function createInvoiceFromQuote(input: {
  teamId: string;
  userId: string;
  quoteId: string;
}): Promise<InvoiceView> {
  const quote = await findQuoteById({
    teamId: input.teamId,
    quoteId: input.quoteId,
  });

  if (!quote) {
    throw new HandledError(errorCodes.quoteNotFound);
  }

  const invoice = await insertInvoice({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: quote.client_id,
    quoteId: quote.id,
    lines: quote.lines,
    totalHt: quote.total_ht,
    totalTtc: quote.total_ttc,
    tvaRate: quote.tva_rate,
  });

  // Generate PDF
  let pdfUrl: string | null = null;
  try {
    const [teamRow, clientRow, fieldRows] = await Promise.all([
      findTeamById(input.teamId),
      findClientById({ teamId: input.teamId, clientId: quote.client_id }),
      findTeamFields(input.teamId),
    ]);

    if (!teamRow) throw new HandledError(errorCodes.teamNotFound);
    if (!clientRow) throw new HandledError(errorCodes.clientNotFound);

    pdfUrl = await generatePdf({
      type: 'invoice',
      id: invoice.id,
      number: invoice.number,
      team: { name: teamRow.name, logoUrl: teamRow.logo_url, fields: fieldRows.map(toTeamField) },
      client: {
        name: clientRow.first_name + ' ' + clientRow.last_name,
        email: clientRow.email,
        phone: clientRow.phone,
        address: clientRow.address,
      },
      lines: invoice.lines,
      totalHt: invoice.total_ht,
      totalTtc: invoice.total_ttc,
      tvaRate: invoice.tva_rate,
      createdAt: invoice.created_at,
      dueDate: invoice.due_date,
    });

    await updateInvoicePdfUrl({ teamId: input.teamId, invoiceId: invoice.id, pdfUrl });
  } catch (err) {
    logger.error('PDF generation failed for invoice', { invoiceId: invoice.id, error: err });
  }

  return {
    id: invoice.id,
    number: invoice.number,
    clientId: invoice.client_id,
    clientName: undefined,
    quoteId: invoice.quote_id,
    lines: invoice.lines,
    totalHt: invoice.total_ht,
    totalTtc: invoice.total_ttc,
    tvaRate: invoice.tva_rate,
    status: invoice.status,
    pdfUrl,
    sentAt: invoice.sent_at?.toISOString() ?? null,
    paidAt: invoice.paid_at?.toISOString() ?? null,
    dueDate: invoice.due_date?.toISOString() ?? null,
    createdAt: invoice.created_at.toISOString(),
  };
}
