import type { QuoteView } from '@tuldio/common';
import { computeQuoteTotals, validateQuoteLine, defaultValidUntil } from '../domain/validators.js';
import { isFieldTrue } from '../../teams/domain/team-field.entity.js';
import { insertQuote } from '../repository/insert-quote.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { getClientDisplayName } from '../../clients/domain/get-client-display-name.js';
import { upsertPrestation } from '../../prestations/repository/upsert-prestation.js';
import { computeLineTotal, resolveTvaRate } from '../../documents/domain/document-math.js';
import { findTeamFieldByKey } from '../../teams/repository/find-team-field-by-key.js';
import { insertDocumentLog } from '../../documents/repository/insert-document-log.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { toLineViews, toTvaGroups } from '../../documents/domain/to-line-views.js';
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

  const { id } = await insertQuote({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: input.clientId,
    title: input.title ?? null,
    validUntil,
    lines: insertLines,
    totalHt,
    totalTtc,
  });

  const client = await findClientById({ teamId: input.teamId, clientId: input.clientId });
  const full = await findQuoteById({ teamId: input.teamId, quoteId: id });

  logger.info('quote.created', { teamId: input.teamId, quoteId: id, number: full!.number, totalTtc });

  await insertDocumentLog({
    teamId: input.teamId,
    documentType: 'quote',
    documentId: id,
    event: 'created',
  });

  return {
    id: full!.id,
    number: full!.number,
    clientId: full!.client_id,
    clientName: client ? getClientDisplayName(client) : undefined,
    clientEmail: client?.email ?? undefined,
    title: full!.title,
    lines: toLineViews(full!.lines),
    totalHt: full!.total_ht,
    totalTtc: full!.total_ttc,
    tvaGroups: toTvaGroups(full!.lines),
    status: full!.status,
    pdfUrl: null,
    validUntil: full!.valid_until?.toISOString() ?? null,
    sentAt: null,
    acceptedAt: null,
    refusedAt: null,
    cancelledAt: null,
    createdAt: full!.created_at.toISOString(),
  };
}
