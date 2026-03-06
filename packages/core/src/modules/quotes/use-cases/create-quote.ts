import type { QuoteView } from '@tuldio/types';
import { computeQuoteTotals } from '../domain/validators.js';
import { insertQuote } from '../repository/insert-quote.js';
import { updateQuotePdfUrl } from '../repository/update-quote-pdf-url.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { findTeamFields } from '../../teams/repository/find-team-fields.js';
import { toTeamField } from '../../teams/domain/team-field.view.js';
import { generatePdf } from '../../../lib/pdf/generate-pdf.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';

export async function createQuote(input: {
  teamId: string;
  userId: string;
  clientId: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  tvaRate: number;
}): Promise<QuoteView> {
  const { totalHt, totalTtc, lines } = computeQuoteTotals({
    lines: input.lines,
    tvaRate: input.tvaRate,
  });

  const row = await insertQuote({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: input.clientId,
    lines,
    totalHt,
    totalTtc,
    tvaRate: input.tvaRate,
  });

  // Generate PDF
  let pdfUrl: string | null = null;
  try {
    const [teamRow, clientRow, fieldRows] = await Promise.all([
      findTeamById(input.teamId),
      findClientById({ teamId: input.teamId, clientId: input.clientId }),
      findTeamFields(input.teamId),
    ]);

    if (!teamRow) throw new HandledError(errorCodes.teamNotFound);
    if (!clientRow) throw new HandledError(errorCodes.clientNotFound);

    pdfUrl = await generatePdf({
      type: 'quote',
      id: row.id,
      number: row.number,
      team: { name: teamRow.name, logoUrl: teamRow.logo_url, fields: fieldRows.map(toTeamField) },
      client: {
        name: clientRow.first_name + ' ' + clientRow.last_name,
        email: clientRow.email,
        phone: clientRow.phone,
        address: clientRow.address,
      },
      lines: row.lines,
      totalHt: row.total_ht,
      totalTtc: row.total_ttc,
      tvaRate: row.tva_rate,
      createdAt: row.created_at,
    });

    await updateQuotePdfUrl({ teamId: input.teamId, quoteId: row.id, pdfUrl });
  } catch (err) {
    logger.error('PDF generation failed for quote', { quoteId: row.id, error: err });
  }

  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    lines: row.lines,
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaRate: row.tva_rate,
    status: row.status,
    pdfUrl,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
