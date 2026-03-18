import type { QuoteView } from '@tuldio/common';
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

  await updateQuoteLines({
    teamId: input.teamId,
    quoteId: input.quoteId,
    lines: insertLines,
    totalHt,
    totalTtc,
    title: input.title,
  });

  const full = await findQuoteById({ teamId: input.teamId, quoteId: input.quoteId });
  if (!full) throw new HandledError(errorCodes.quoteNotFound);

  logger.info('quote.updated', { teamId: input.teamId, quoteId: input.quoteId, number: full.number, totalTtc });

  return {
    id: full.id,
    number: full.number,
    clientId: full.client_id,
    title: full.title,
    lines: toLineViews(full.lines),
    totalHt: full.total_ht,
    totalTtc: full.total_ttc,
    tvaGroups: toTvaGroups(full.lines),
    status: full.status,
    pdfUrl: null,
    validUntil: full.valid_until?.toISOString() ?? null,
    sentAt: full.sent_at?.toISOString() ?? null,
    acceptedAt: full.accepted_at?.toISOString() ?? null,
    refusedAt: full.refused_at?.toISOString() ?? null,
    cancelledAt: full.cancelled_at?.toISOString() ?? null,
    createdAt: full.created_at.toISOString(),
  };
}
