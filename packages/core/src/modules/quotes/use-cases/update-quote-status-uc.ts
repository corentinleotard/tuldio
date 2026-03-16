import type { QuoteView } from '@tuldio/common';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { validateQuoteStatusTransition } from '../domain/validators.js';
import { validateDocumentReady } from '../../documents/domain/validate-document-ready.js';
import { fetchDocumentContext } from '../../documents/repository/fetch-document-context.js';
import { findQuoteById } from '../repository/find-quote-by-id.js';
import { updateQuoteStatus } from '../repository/update-quote-status.js';
import { updateQuotePdfUrl } from '../repository/update-quote-pdf-url.js';
import { assignQuoteNumber } from '../repository/assign-quote-number.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { generatePdf } from '../../../lib/pdf/generate-pdf.js';
import { buildDocumentPdfInput } from '../../../lib/pdf/build-document-pdf-input.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { getClientDisplayName } from '../../clients/domain/get-client-display-name.js';
import { toLineViews, toTvaGroups } from '../../documents/domain/to-line-views.js';
import { insertDocumentLog } from '../../documents/repository/insert-document-log.js';

export async function updateQuoteStatusUc(input: {
  teamId: string;
  quoteId: string;
  status: string;
}): Promise<QuoteView> {
  const current = await findQuoteById({
    teamId: input.teamId,
    quoteId: input.quoteId,
  });
  if (!current) {
    throw new HandledError(errorCodes.quoteNotFound);
  }

  const isValid = validateQuoteStatusTransition({
    from: current.status,
    to: input.status,
  });
  if (!isValid) {
    throw new HandledError(errorCodes.invalidStatusTransition);
  }

  // Assign sequential number when leaving draft (number was BROUILLON-xxx until now)
  if (current.status === 'draft') {
    const team = await findTeamById(input.teamId);
    const number = await assignQuoteNumber({
      teamId: input.teamId,
      quoteId: current.id,
      lastNumber: team?.quote_last_number ?? 0,
    });
    current.number = number;
  }

  // Validate document readiness when leaving draft
  if (current.status === 'draft') {
    const { team, client: clientRow, teamFields } = await fetchDocumentContext({
      teamId: input.teamId,
      clientId: current.client_id,
    });

    const readinessErrors = validateDocumentReady({
      documentType: 'quote',
      team: { name: team.name },
      teamFields,
      client: { firstName: clientRow.first_name, lastName: clientRow.last_name, companyName: clientRow.company_name, siret: clientRow.siret, address: clientRow.address },
      lines: current.lines,
    });
    if (readinessErrors.length > 0) {
      throw new HandledError(errorCodes.documentNotReady, readinessErrors[0]!.message, readinessErrors);
    }
  }

  // Freeze PDF when leaving draft
  let pdfUrl = current.pdf_url;
  if (current.status === 'draft' && !pdfUrl) {
    const lineViews = toLineViews(current.lines);
    const tvaGroups = toTvaGroups(current.lines);
    const pdfInput = await buildDocumentPdfInput({
      type: 'quote',
      teamId: input.teamId,
      id: current.id,
      number: current.number,
      clientId: current.client_id,
      lines: lineViews,
      totalHt: current.total_ht,
      totalTtc: current.total_ttc,
      tvaGroups,
      createdAt: current.created_at,
      validUntil: current.valid_until,
    });
    pdfUrl = await generatePdf(pdfInput);
    await updateQuotePdfUrl({ teamId: input.teamId, quoteId: current.id, pdfUrl });
  }

  const row = await updateQuoteStatus(input);
  const client = await findClientById({ teamId: input.teamId, clientId: row.client_id });

  logger.info('quote.status_changed', { teamId: input.teamId, quoteId: input.quoteId, from: current.status, to: input.status });

  await insertDocumentLog({
    teamId: input.teamId,
    documentType: 'quote',
    documentId: input.quoteId,
    event: 'status_changed',
    metadata: { from: current.status, to: input.status },
  });

  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: client ? getClientDisplayName(client) : undefined,
    clientEmail: client?.email ?? undefined,
    title: row.title,
    lines: toLineViews(current.lines),
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaGroups: toTvaGroups(current.lines),
    status: row.status,
    pdfUrl: pdfUrl ?? row.pdf_url,
    validUntil: row.valid_until?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    refusedAt: row.refused_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
