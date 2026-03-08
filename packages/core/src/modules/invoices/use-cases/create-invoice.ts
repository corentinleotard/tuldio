import type { InvoiceView } from '@tuldio/types';
import { computeInvoiceTotals, validateInvoiceLine } from '../domain/validators.js';
import { insertInvoice } from '../repository/insert-invoice.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { computeLineTotal } from '../../shared/domain/document-math.js';
import { toLineViews, toTvaGroups } from '../../shared/domain/to-line-views.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';
import type { InvoiceLineRow } from '../domain/invoice.entity.js';

export function toInvoiceView(
  row: InvoiceRow & { lines?: InvoiceLineRow[] },
  opts?: { clientName?: string; clientEmail?: string },
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
    pdfUrl: row.pdf_url,
    sentAt: row.sent_at?.toISOString() ?? null,
    paidAt: row.paid_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    dueDate: row.due_date?.toISOString() ?? null,
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
}): Promise<InvoiceView> {
  const linesWithDefaults = input.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit ?? 'u',
    unitPrice: l.unitPrice,
    tvaRate: l.tvaRate ?? 2000,
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

  const invoice = await insertInvoice({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: input.clientId,
    title: input.title ?? null,
    lines: insertLines,
    totalHt,
    totalTtc,
    dueDate: input.dueDate,
  });

  logger.info('invoice.created', { teamId: input.teamId, invoiceId: invoice.id, number: invoice.number, totalTtc });

  const client = await findClientById({ teamId: input.teamId, clientId: input.clientId });
  const full = await findInvoiceById({ teamId: input.teamId, invoiceId: invoice.id });

  return toInvoiceView(full!, {
    clientName: client ? `${client.first_name} ${client.last_name}` : undefined,
    clientEmail: client?.email ?? undefined,
  });
}
