import type { InvoiceView } from '@tuldio/types';
import { findInvoicesByTeam } from '../repository/find-invoices-by-team.js';

export async function listInvoices(input: {
  teamId: string;
  clientId?: string | null;
  limit?: number;
}): Promise<InvoiceView[]> {
  const invoices = await findInvoicesByTeam({ teamId: input.teamId, clientId: input.clientId, limit: input.limit });

  return invoices.map((row) => ({
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: row.client_name,
    clientEmail: row.client_email ?? undefined,
    quoteId: row.quote_id,
    title: row.title,
    lines: [],
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaGroups: [],
    status: row.status,
    pdfUrl: row.pdf_url,
    sentAt: row.sent_at?.toISOString() ?? null,
    paidAt: row.paid_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    dueDate: row.due_date?.toISOString() ?? null,
    prestationDate: row.prestation_date?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }));
}
