import type { InvoiceView } from '@tuldio/common';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { validateInvoiceStatusTransition, acompteTotalExceedsQuote } from '../domain/validators.js';
import { validateDocumentReady } from '../../documents/domain/validate-document-ready.js';
import { categorizeReadinessErrors } from '../../documents/domain/categorize-readiness-errors.js';
import { fetchDocumentContext } from '../../documents/repository/fetch-document-context.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { updateInvoiceStatus } from '../repository/update-invoice-status.js';
import { updateInvoicePdfUrl } from '../repository/update-invoice-pdf-url.js';
import { assignInvoiceNumber } from '../repository/assign-invoice-number.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { generatePdf } from '../../../lib/pdf/generate-pdf.js';
import { buildDocumentPdfInput } from '../../../lib/pdf/build-document-pdf-input.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { getClientDisplayName } from '../../clients/domain/get-client-display-name.js';
import { toLineViews, toTvaGroups } from '../../documents/domain/to-line-views.js';
import { toInvoiceView } from './create-invoice.js';
import { createAvoir } from './create-avoir.js';
import { findInvoicesByQuote } from '../repository/find-invoices-by-quote.js';
import { findQuoteById } from '../../quotes/repository/find-quote-by-id.js';
import { insertDocumentLog } from '../../documents/repository/insert-document-log.js';

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

  // Cancelling a non-draft non-avoir invoice: create avoir (legal requirement — document was communicated to client)
  const needsAvoir = input.status === 'cancelled' && invoice.status !== 'draft' && invoice.status !== 'cancelled' && invoice.invoice_type !== 'avoir';
  if (needsAvoir) {
    if (!input.userId) throw new HandledError(errorCodes.invalidInput);
    const avoir = await createAvoir({ teamId: input.teamId, userId: input.userId, sourceInvoiceId: invoice.id });
    await updateInvoiceStatus({ teamId: input.teamId, invoiceId: invoice.id, status: 'cancelled' });
    logger.info('invoice.cancelled_with_avoir', { teamId: input.teamId, invoiceId: invoice.id, avoirId: avoir.id });

    await insertDocumentLog({
      teamId: input.teamId,
      documentType: 'invoice',
      documentId: invoice.id,
      event: 'status_changed',
      metadata: { from: invoice.status, to: 'cancelled', avoirId: avoir.id },
    });

    // Return the cancelled source (not the avoir) — cancellation is the user's intent
    const full = await findInvoiceById({ teamId: input.teamId, invoiceId: invoice.id });
    if (!full) throw new HandledError(errorCodes.invoiceNotFound);
    const client = await findClientById({ teamId: input.teamId, clientId: full.client_id });
    return toInvoiceView(full, {
      clientName: client ? getClientDisplayName(client) : undefined,
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

  // Assign sequential number when leaving draft (number was BROUILLON-xxx until now)
  if (invoice.status === 'draft') {
    const team = await findTeamById(input.teamId);
    const lastNumber = invoice.invoice_type === 'avoir'
      ? (team?.avoir_last_number ?? 0)
      : (team?.invoice_last_number ?? 0);
    const number = await assignInvoiceNumber({
      teamId: input.teamId,
      invoiceId: invoice.id,
      invoiceType: invoice.invoice_type,
      lastNumber,
    });
    invoice.number = number;
  }

  // Guard: acompte total must not exceed quote total when leaving draft
  if (invoice.status === 'draft' && invoice.invoice_type === 'acompte' && invoice.quote_id) {
    const quote = await findQuoteById({ teamId: input.teamId, quoteId: invoice.quote_id });
    if (quote) {
      const existingAcomptes = await findInvoicesByQuote({
        teamId: input.teamId,
        quoteId: invoice.quote_id,
        invoiceType: 'acompte',
      });
      const existingAcomptesHt = existingAcomptes.reduce((sum, inv) => sum + inv.total_ht, 0);
      if (acompteTotalExceedsQuote({ existingAcomptesHt, newAcompteHt: invoice.total_ht, quoteTotalHt: quote.total_ht })) {
        throw new HandledError(errorCodes.acompteExceedsQuote);
      }
    }
  }

  // Validate document readiness when leaving draft
  if (invoice.status === 'draft') {
    const { team, client: clientRow, teamFields } = await fetchDocumentContext({
      teamId: input.teamId,
      clientId: invoice.client_id,
    });

    const readinessErrors = validateDocumentReady({
      documentType: 'invoice',
      team: { name: team.name },
      teamFields,
      client: { firstName: clientRow.first_name, lastName: clientRow.last_name, companyName: clientRow.company_name, siret: clientRow.siret, address: clientRow.address },
      lines: invoice.lines,
    });
    if (readinessErrors.length > 0) {
      const { teamErrors } = categorizeReadinessErrors({ errors: readinessErrors });
      if (teamErrors.length > 0) {
        throw new HandledError(errorCodes.companyInfoRequired, teamErrors[0]!.message, readinessErrors);
      }
      throw new HandledError(errorCodes.documentNotReady, readinessErrors[0]!.message, readinessErrors);
    }
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

  await insertDocumentLog({
    teamId: input.teamId,
    documentType: 'invoice',
    documentId: input.invoiceId,
    event: 'status_changed',
    metadata: { from: invoice.status, to: input.status },
  });

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
    clientName: client ? getClientDisplayName(client) : undefined,
    clientEmail: client?.email ?? undefined,
    sourceInvoiceNumber,
  });
}
