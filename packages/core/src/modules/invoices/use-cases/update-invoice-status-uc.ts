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

export async function updateInvoiceStatusUc(input: {
  teamId: string;
  invoiceId: string;
  status: string;
}): Promise<InvoiceView> {
  const invoice = await findInvoiceById({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!invoice) {
    throw new HandledError(errorCodes.invoiceNotFound);
  }

  // Standard status transition
  const isValid = validateInvoiceStatusTransition({
    from: invoice.status,
    to: input.status,
  });
  if (!isValid) {
    throw new HandledError(errorCodes.invalidStatusTransition);
  }

  // Freeze PDF when leaving draft
  if (invoice.status === 'draft' && !invoice.pdf_url) {
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
      prestationDate: invoice.prestation_date,
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
  return toInvoiceView(full, {
    clientName: client ? `${client.first_name} ${client.last_name}` : undefined,
    clientEmail: client?.email ?? undefined,
  });
}
