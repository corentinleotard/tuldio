import type { QuoteView } from '@tuldio/types';
import { computeQuoteTotals } from '../domain/validators.js';
import { insertQuote } from '../repository/insert-quote.js';

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

  // TODO: PDF generation will be reimplemented with Puppeteer + React template

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
