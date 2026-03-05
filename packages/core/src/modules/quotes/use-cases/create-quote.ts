import type { QuoteView } from '@tuldio/types';
import { computeQuoteTotals } from '../domain/validators.js';
import { insertQuote } from '../repository/insert-quote.js';
import { updateQuotePdfUrl } from '../repository/update-quote-pdf-url.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { renderQuotePdf } from '../../../lib/pdf/render-pdf.js';
import { formatShortDate } from '../../../lib/infra/format.js';

export async function createQuote(input: {
  teamId: string;
  userId: string;
  clientId: string;
  templateId: string;
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
    templateId: input.templateId,
    lines,
    totalHt,
    totalTtc,
    tvaRate: input.tvaRate,
  });

  const [team, client] = await Promise.all([
    findTeamById(input.teamId),
    findClientById({ teamId: input.teamId, clientId: input.clientId }),
  ]);

  if (team && client) {
    const pdfUrl = await renderQuotePdf({
      number: row.number,
      date: formatShortDate(row.created_at.toISOString()),
      company: { name: team.name, siret: team.siret, address: team.address },
      client: { name: client.name, email: client.email, address: client.address },
      lines: row.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        total: l.quantity * l.unitPrice,
      })),
      totalHt: row.total_ht,
      totalTtc: row.total_ttc,
      tvaRate: row.tva_rate,
    });

    await updateQuotePdfUrl({ teamId: input.teamId, quoteId: row.id, pdfUrl });
    row.pdf_url = pdfUrl;
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
    pdfUrl: row.pdf_url,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}
