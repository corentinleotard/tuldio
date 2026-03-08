import type { QuoteView } from '@tuldio/types';
import { findQuotesByTeam } from '../repository/find-quotes-by-team.js';

export async function listQuotes(input: {
  teamId: string;
  clientId?: string | null;
  limit?: number;
}): Promise<QuoteView[]> {
  const rows = await findQuotesByTeam({ teamId: input.teamId, clientId: input.clientId, limit: input.limit });

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: row.client_name,
    clientEmail: row.client_email ?? undefined,
    title: row.title,
    lines: [],
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaGroups: [],
    status: row.status,
    pdfUrl: row.pdf_url,
    validUntil: row.valid_until?.toISOString() ?? null,
    sentAt: row.sent_at?.toISOString() ?? null,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    refusedAt: row.refused_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }));
}
