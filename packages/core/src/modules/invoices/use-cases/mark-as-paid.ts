import type { InvoiceView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { validateInvoiceStatusTransition } from '../domain/validators.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { updateInvoiceStatus } from '../repository/update-invoice-status.js';
import { updateInvoicePdfUrl } from '../repository/update-invoice-pdf-url.js';
import { generatePdf } from '../../../lib/pdf/generate-pdf.js';
import { buildDocumentPdfInput } from '../../../lib/pdf/build-document-pdf-input.js';
import { toLineViews, toTvaGroups } from '../../shared/domain/to-line-views.js';
import { toInvoiceView } from './create-invoice.js';

export async function updateInvoiceStatusUc(input: {
  teamId: string;
  invoiceId: string;
  status: string;
}): Promise<InvoiceView> {
  const invoice = await findInvoiceById({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!invoice) {
    throw new HandledError(errorCodes.invoiceNotFound);
  }

  const isValid = validateInvoiceStatusTransition({
    from: invoice.status,
    to: input.status,
  });

  if (!isValid) {
    throw new HandledError(errorCodes.invalidStatusTransition);
  }

  // Freeze PDF when transitioning to sent
  if (input.status === 'sent' && !invoice.pdf_url) {
    const lineViews = toLineViews(invoice.lines);
    const tvaGroups = toTvaGroups(invoice.lines);
    const pdfInput = await buildDocumentPdfInput({
      type: 'invoice',
      teamId: input.teamId,
      id: invoice.id,
      number: invoice.number,
      clientId: invoice.client_id,
      lines: lineViews,
      totalHt: invoice.total_ht,
      totalTtc: invoice.total_ttc,
      tvaGroups,
      createdAt: invoice.created_at,
      dueDate: invoice.due_date,
    });
    const pdfUrl = await generatePdf(pdfInput);
    await updateInvoicePdfUrl({ teamId: input.teamId, invoiceId: invoice.id, pdfUrl });
  }

  await updateInvoiceStatus({
    teamId: input.teamId,
    invoiceId: input.invoiceId,
    status: input.status,
  });

  // Re-fetch with lines for the view
  const full = await findInvoiceById({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!full) throw new HandledError(errorCodes.invoiceNotFound);
  return toInvoiceView(full);
}

export async function markAsPaid(input: {
  teamId: string;
  invoiceId: string;
}): Promise<InvoiceView> {
  return updateInvoiceStatusUc({ ...input, status: 'paid' });
}
