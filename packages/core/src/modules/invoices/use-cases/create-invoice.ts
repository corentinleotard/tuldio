import type { InvoiceView } from '@tuldio/common';
import { isFieldTrue } from '../../teams/domain/team-field.entity.js';
import { computeDueDate, computeInvoiceTotals, validateInvoiceLine } from '../domain/validators.js';
import { insertInvoice } from '../repository/insert-invoice.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { computeLineTotal, resolveTvaRate } from '../../documents/domain/document-math.js';
import { findTeamFieldByKey } from '../../teams/repository/find-team-field-by-key.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { toLineViews, toTvaGroups } from '../../documents/domain/to-line-views.js';
import { getClientDisplayName } from '../../clients/domain/get-client-display-name.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import type { InvoiceRow, InvoiceLineRow } from '../domain/invoice.entity.js';
import { insertDocumentLog } from '../../documents/repository/insert-document-log.js';

export function toInvoiceView(
  row: InvoiceRow & { lines?: InvoiceLineRow[] },
  opts?: { clientName?: string; clientEmail?: string; sourceInvoiceNumber?: string },
): InvoiceView {
  const lines = row.lines ?? [];
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: opts?.clientName,
    clientEmail: opts?.clientEmail,
    quoteId: row.quote_id,
    title: row.title,
    lines: toLineViews(lines),
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaGroups: toTvaGroups(lines),
    status: row.status,
    invoiceType: row.invoice_type,
    sourceInvoiceId: row.source_invoice_id,
    sourceInvoiceNumber: opts?.sourceInvoiceNumber ?? null,
    situationNumber: row.situation_number,
    avoirId: row.avoir_id,
    pdfUrl: row.pdf_url,
    pdpId: row.pdp_id,
    pdpStatus: row.pdp_status,
    sentAt: row.sent_at?.toISOString() ?? null,
    paidAt: row.paid_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    dueDate: row.due_date?.toISOString() ?? null,
    prestationDate: row.prestation_date?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

interface CreateInvoiceLineInput {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  tvaRate?: number;
}

export async function createInvoice(input: {
  teamId: string;
  userId: string;
  clientId: string;
  title?: string;
  lines: CreateInvoiceLineInput[];
  dueDate?: Date;
  prestationDate?: Date;
}): Promise<InvoiceView> {
  const team = await findTeamById(input.teamId);
  const tvaExemptField = await findTeamFieldByKey({ teamId: input.teamId, key: 'tva_exempt' });
  const tvaExempt = isFieldTrue(tvaExemptField);

  const linesWithDefaults = input.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit ?? 'u',
    unitPrice: l.unitPrice,
    tvaRate: resolveTvaRate({ requestedRate: l.tvaRate ?? 2000, tvaExempt }),
  }));

  // Validate each line
  for (const line of linesWithDefaults) {
    const errors = validateInvoiceLine(line);
    if (errors.length > 0) {
      throw new HandledError(errorCodes.invalidInput, errors.join(', '));
    }
  }

  const { totalHt, totalTtc } = computeInvoiceTotals(linesWithDefaults);

  const insertLines = linesWithDefaults.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    unitPrice: l.unitPrice,
    tvaRate: l.tvaRate,
    totalHt: computeLineTotal({ quantity: l.quantity, unitPrice: l.unitPrice }),
  }));

  const { id: invoiceId } = await insertInvoice({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: input.clientId,
    title: input.title ?? null,
    prestationDate: input.prestationDate ?? new Date(),
    lines: insertLines,
    totalHt,
    totalTtc,
    dueDate: input.dueDate ?? computeDueDate({ createdAt: new Date(), delayDays: team?.invoice_payment_delay_days ?? 30 }),
  });

  logger.info('invoice.created', { teamId: input.teamId, invoiceId, totalTtc });

  await insertDocumentLog({
    teamId: input.teamId,
    documentType: 'invoice',
    documentId: invoiceId,
    event: 'created',
  });

  const client = await findClientById({ teamId: input.teamId, clientId: input.clientId });
  const full = await findInvoiceById({ teamId: input.teamId, invoiceId });

  return toInvoiceView(full!, {
    clientName: client ? getClientDisplayName(client) : undefined,
    clientEmail: client?.email ?? undefined,
  });
}
