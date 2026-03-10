import type { QuoteView } from '@tuldio/types';
import { computeQuoteTotals, validateQuoteLine, defaultValidUntil } from '../domain/validators.js';
import { isFieldTrue } from '../../teams/domain/team-field.entity.js';
import { insertQuote } from '../repository/insert-quote.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { upsertPrestation } from '../../prestations/repository/upsert-prestation.js';
import { computeLineTotal, resolveTvaRate } from '../../shared/domain/document-math.js';
import { findTeamFieldByKey } from '../../teams/repository/find-team-field-by-key.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { toLineViews, toTvaGroups } from '../../shared/domain/to-line-views.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';

interface CreateQuoteLineInput {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  tvaRate?: number;
}

export async function createQuote(input: {
  teamId: string;
  userId: string;
  clientId: string;
  title?: string;
  lines: CreateQuoteLineInput[];
}): Promise<QuoteView> {
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
    const errors = validateQuoteLine(line);
    if (errors.length > 0) {
      throw new HandledError(errorCodes.invalidInput, errors.join(', '));
    }
  }

  const { totalHt, totalTtc } = computeQuoteTotals(linesWithDefaults);

  // Upsert prestations into catalog
  const prestationIds = await Promise.all(
    linesWithDefaults.map((l) =>
      upsertPrestation({
        teamId: input.teamId,
        type: 'service',
        description: l.description,
        unit: l.unit,
        defaultUnitPrice: l.unitPrice,
        defaultTvaRate: l.tvaRate,
      }),
    ),
  );

  const insertLines = linesWithDefaults.map((l, i) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    unitPrice: l.unitPrice,
    tvaRate: l.tvaRate,
    totalHt: computeLineTotal({ quantity: l.quantity, unitPrice: l.unitPrice }),
    prestationId: prestationIds[i],
  }));

  const validUntil = defaultValidUntil({ createdAt: new Date(), days: team?.quote_validity_days ?? 30 });

  const row = await insertQuote({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: input.clientId,
    title: input.title ?? null,
    validUntil,
    lastNumber: team?.quote_last_number ?? 0,
    lines: insertLines,
    totalHt,
    totalTtc,
  });

  const client = await findClientById({ teamId: input.teamId, clientId: input.clientId });

  // Re-fetch lines for view (we need the generated IDs)
  const full = await findQuoteById({ teamId: input.teamId, quoteId: row.id });

  logger.info('quote.created', { teamId: input.teamId, quoteId: row.id, number: row.number, totalTtc });

  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: client ? `${client.first_name} ${client.last_name}` : undefined,
    clientEmail: client?.email ?? undefined,
    title: row.title,
    lines: toLineViews(full!.lines),
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaGroups: toTvaGroups(full!.lines),
    status: row.status,
    pdfUrl: null,
    validUntil: row.valid_until?.toISOString() ?? null,
    sentAt: null,
    acceptedAt: null,
    refusedAt: null,
    cancelledAt: null,
    createdAt: row.created_at.toISOString(),
  };
}
