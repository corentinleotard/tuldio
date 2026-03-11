import type { InvoiceView } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { validateInvoiceStatusTransition } from '../domain/validators.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { updateInvoiceStatus } from '../repository/update-invoice-status.js';
import { updateInvoicePdfUrl } from '../repository/update-invoice-pdf-url.js';
import { generatePdf } from '../../../lib/pdf/generate-pdf.js';
import { buildDocumentPdfInput } from '../../../lib/pdf/build-document-pdf-input.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { toLineViews, toTvaGroups } from '../../shared/domain/to-line-views.js';
import { toInvoiceView } from './create-invoice.js';
import { createAvoir } from './create-avoir.js';

export async function updateInvoiceStatusUc(input: {
  teamId: string;
  userId?: string;
  invoiceId: string;
  status: string;
}): Promise<InvoiceView> {
  const invoice = await findInvoiceById({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!invoice) {
    throw new HandledError(errorCodes.invoiceNotFound);
  }

  // Cancelling a paid non-avoir invoice: create avoir (legal requirement) + cancel source
  if (input.status === 'cancelled' && invoice.status === 'paid' && invoice.invoice_type !== 'avoir') {
    if (!input.userId) throw new HandledError(errorCodes.invalidInput);
    const avoir = await createAvoir({ teamId: input.teamId, userId: input.userId, sourceInvoiceId: invoice.id });
    await updateInvoiceStatus({ teamId: input.teamId, invoiceId: invoice.id, status: 'cancelled' });
    logger.info('invoice.cancelled_with_avoir', { teamId: input.teamId, invoiceId: invoice.id, avoirId: avoir.id });

    // Return the cancelled source (not the avoir) — cancellation is the user's intent
    const full = await findInvoiceById({ teamId: input.teamId, invoiceId: invoice.id });
    if (!full) throw new HandledError(errorCodes.invoiceNotFound);
    const client = await findClientById({ teamId: input.teamId, clientId: full.client_id });
    return toInvoiceView(full, {
      clientName: client ? `${client.first_name} ${client.last_name}` : undefined,
      clientEmail: client?.email ?? undefined,
    });
  }

  // Standard status transition
  const isValid = validateInvoiceStatusTransition({
    from: invoice.status,
    to: input.status,
    invoiceType: invoice.invoice_type,
  });
  if (!isValid) {
    throw new HandledError(errorCodes.invalidStatusTransition);
  }

  // Freeze PDF when leaving draft
  if (invoice.status === 'draft' && !invoice.pdf_url) {
    const lineViews = toLineViews(invoice.lines);
    const tvaGroups = toTvaGroups(invoice.lines);
    // Resolve source invoice number for avoir PDF
    let sourceInvoiceNumber: string | null = null;
    if (invoice.invoice_type === 'avoir' && invoice.source_invoice_id) {
      const sourceInv = await findInvoiceById({ teamId: input.teamId, invoiceId: invoice.source_invoice_id });
      sourceInvoiceNumber = sourceInv?.number ?? null;
    }

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
      prestationDate: invoice.prestation_date,
      invoiceType: invoice.invoice_type,
      sourceInvoiceNumber,
      situationNumber: invoice.situation_number,
    });
    const pdfUrl = await generatePdf(pdfInput);
    await updateInvoicePdfUrl({ teamId: input.teamId, invoiceId: invoice.id, pdfUrl });
  }

  await updateInvoiceStatus({
    teamId: input.teamId,
    invoiceId: input.invoiceId,
    status: input.status,
  });

  logger.info('invoice.status_changed', { teamId: input.teamId, invoiceId: input.invoiceId, from: invoice.status, to: input.status });

  const full = await findInvoiceById({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!full) throw new HandledError(errorCodes.invoiceNotFound);
  const client = await findClientById({ teamId: input.teamId, clientId: full.client_id });

  // Resolve source invoice number for avoir
  let sourceInvoiceNumber: string | undefined;
  if (full.source_invoice_id) {
    const sourceInv = await findInvoiceById({ teamId: input.teamId, invoiceId: full.source_invoice_id });
    sourceInvoiceNumber = sourceInv?.number;
  }

  return toInvoiceView(full, {
    clientName: client ? `${client.first_name} ${client.last_name}` : undefined,
    clientEmail: client?.email ?? undefined,
    sourceInvoiceNumber,
  });
}
