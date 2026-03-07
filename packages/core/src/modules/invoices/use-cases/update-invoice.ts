import type { InvoiceView } from '@tuldio/types';
import { computeInvoiceTotals, validateInvoiceLine, canEditInvoice } from '../domain/validators.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { updateInvoiceLines } from '../repository/update-invoice-lines.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { computeLineTotal } from '../../shared/domain/document-math.js';
import { toInvoiceView } from './create-invoice.js';

interface UpdateInvoiceLineInput {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  tvaRate?: number;
}

export async function updateInvoice(input: {
  teamId: string;
  invoiceId: string;
  lines: UpdateInvoiceLineInput[];
  title?: string;
}): Promise<InvoiceView> {
  const existing = await findInvoiceById({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!existing) throw new HandledError(errorCodes.invoiceNotFound);

  if (!canEditInvoice(existing.status)) {
    throw new HandledError(errorCodes.invoiceNotDraft);
  }

  const linesWithDefaults = input.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit ?? 'u',
    unitPrice: l.unitPrice,
    tvaRate: l.tvaRate ?? 2000,
  }));

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

  const row = await updateInvoiceLines({
    teamId: input.teamId,
    invoiceId: input.invoiceId,
    lines: insertLines,
    totalHt,
    totalTtc,
    title: input.title,
  });

  if (!row) throw new HandledError(errorCodes.invoiceNotFound);

  logger.info('invoice.updated', { teamId: input.teamId, invoiceId: input.invoiceId, number: row.number, totalTtc });

  const full = await findInvoiceById({ teamId: input.teamId, invoiceId: input.invoiceId });
  if (!full) throw new HandledError(errorCodes.invoiceNotFound);

  return toInvoiceView(full);
}
