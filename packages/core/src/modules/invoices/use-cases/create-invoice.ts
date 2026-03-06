import type { InvoiceView } from '@tuldio/types';
import { computeInvoiceTotals } from '../domain/validators.js';
import { insertInvoice } from '../repository/insert-invoice.js';
import { updateInvoicePdfUrl } from '../repository/update-invoice-pdf-url.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { findTeamFields } from '../../teams/repository/find-team-fields.js';
import { toTeamField } from '../../teams/domain/team-field.view.js';
import { generatePdf } from '../../../lib/pdf/generate-pdf.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

function toInvoiceView(row: InvoiceRow, pdfUrl?: string | null): InvoiceView {
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: undefined,
    quoteId: row.quote_id,
    lines: row.lines,
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaRate: row.tva_rate,
    status: row.status,
    pdfUrl: pdfUrl ?? row.pdf_url,
    sentAt: row.sent_at?.toISOString() ?? null,
    paidAt: row.paid_at?.toISOString() ?? null,
    dueDate: row.due_date?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createInvoice(input: {
  teamId: string;
  userId: string;
  clientId: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  tvaRate: number;
  dueDate?: Date;
}): Promise<InvoiceView> {
  const { totalHt, totalTtc, lines } = computeInvoiceTotals({
    lines: input.lines,
    tvaRate: input.tvaRate,
  });

  const invoice = await insertInvoice({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: input.clientId,
    lines,
    totalHt,
    totalTtc,
    tvaRate: input.tvaRate,
    dueDate: input.dueDate,
  });

  // Generate PDF
  let pdfUrl: string | null = null;
  try {
    const [teamRow, clientRow, fieldRows] = await Promise.all([
      findTeamById(input.teamId),
      findClientById({ teamId: input.teamId, clientId: input.clientId }),
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

  return toInvoiceView(invoice, pdfUrl);
}
