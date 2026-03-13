import type { QuoteView } from '@tuldio/types';
import { computeQuoteTotals, validateQuoteLine, canEditQuote } from '../domain/validators.js';
import { isFieldTrue } from '../../teams/domain/team-field.entity.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { updateQuoteLines } from '../repository/update-quote-lines.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { computeLineTotal, resolveTvaRate } from '../../documents/domain/document-math.js';
import { findTeamFieldByKey } from '../../teams/repository/find-team-field-by-key.js';
import { toLineViews, toTvaGroups } from '../../documents/domain/to-line-views.js';
import { query } from '../../../lib/database/db.js';

interface UpdateQuoteLineInput {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  tvaRate?: number;
}

export async function updateQuote(input: {
  teamId: string;
  quoteId: string;
  lines: UpdateQuoteLineInput[];
  title?: string;
}): Promise<QuoteView> {
  const existing = await findQuoteById({ teamId: input.teamId, quoteId: input.quoteId });
  if (!existing) throw new HandledError(errorCodes.quoteNotFound);

  // Check if quote has linked invoices
  const invoiceCheck = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM invoices WHERE quote_id = $1 AND status != 'cancelled'`,
    [input.quoteId],
  );
  const hasLinkedInvoices = Number(invoiceCheck.rows[0]?.count ?? 0) > 0;

  if (!canEditQuote({ status: existing.status, hasLinkedInvoices })) {
    throw new HandledError(errorCodes.quoteNotDraft);
  }

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
    const errors = validateQuoteLine(line);
    if (errors.length > 0) {
      throw new HandledError(errorCodes.invalidInput, errors.join(', '));
    }
  }

  const { totalHt, totalTtc } = computeQuoteTotals(linesWithDefaults);

  const insertLines = linesWithDefaults.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    unitPrice: l.unitPrice,
    tvaRate: l.tvaRate,
    totalHt: computeLineTotal({ quantity: l.quantity, unitPrice: l.unitPrice }),
  }));

  const row = await updateQuoteLines({
    teamId: input.teamId,
    quoteId: input.quoteId,
    lines: insertLines,
    totalHt,
    totalTtc,
    title: input.title,
  });

  if (!row) throw new HandledError(errorCodes.quoteNotFound);

  logger.info('quote.updated', { teamId: input.teamId, quoteId: input.quoteId, number: row.number, totalTtc });

  const full = await findQuoteById({ teamId: input.teamId, quoteId: input.quoteId });

  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    title: row.title,
    lines: toLineViews(full!.lines),
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaGroups: toTvaGroups(full!.lines),
    status: row.status,
    pdfUrl: null,
    validUntil: row.valid_until?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    refusedAt: row.refused_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
