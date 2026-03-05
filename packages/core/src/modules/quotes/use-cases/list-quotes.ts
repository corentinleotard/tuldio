import type { QuoteView } from '@tuldio/types';
import { findQuotesByTeam } from '../repository/find-quotes-by-team.js';

export async function listQuotes(teamId: string): Promise<QuoteView[]> {
  const rows = await findQuotesByTeam(teamId);

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: row.client_name,
    lines: row.lines,
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaRate: row.tva_rate,
    status: row.status,
    pdfUrl: row.pdf_url,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }));
}
