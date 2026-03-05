import { computeInvoiceTotals } from '../domain/validators.js';
import { insertInvoice } from '../repository/insert-invoice.js';
import { updateInvoicePdfUrl } from '../repository/update-invoice-pdf-url.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { renderInvoicePdf } from '../../../lib/pdf/render-pdf.js';
import { formatShortDate } from '../../../lib/infra/format.js';
import type { InvoiceRow } from '../domain/invoice.entity.js';

interface InvoiceView {
  id: string;
  number: string;
  clientId: string;
  clientName: string | null;
  quoteId: string | null;
  lines: InvoiceRow['lines'];
  totalHt: number;
  totalTtc: number;
  tvaRate: number;
  status: string;
  pdfUrl: string | null;
  sentAt: string | null;
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
}

function toInvoiceView(row: InvoiceRow, clientName?: string): InvoiceView {
  return {
    id: row.id,
    number: row.number,
    clientId: row.client_id,
    clientName: clientName ?? null,
    quoteId: row.quote_id,
    lines: row.lines,
    totalHt: row.total_ht,
    totalTtc: row.total_ttc,
    tvaRate: row.tva_rate,
    status: row.status,
    pdfUrl: row.pdf_url,
    sentAt: row.sent_at?.toISOString() ?? null,
    paidAt: row.paid_at?.toISOString() ?? null,
    dueDate: row.due_date?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createInvoice(input: {
  teamId: string;
  userId: string;
  clientId: string;
  templateId: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  tvaRate: number;
  dueDate?: Date;
}): Promise<InvoiceView> {
  const { totalHt, totalTtc, lines } = computeInvoiceTotals({
    lines: input.lines,
    tvaRate: input.tvaRate,
  });

  const invoice = await insertInvoice({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: input.clientId,
    templateId: input.templateId,
    lines,
    totalHt,
    totalTtc,
    tvaRate: input.tvaRate,
    dueDate: input.dueDate,
  });

  const [team, client] = await Promise.all([
    findTeamById(input.teamId),
    findClientById({ teamId: input.teamId, clientId: input.clientId }),
  ]);

  if (team && client) {
    const pdfUrl = await renderInvoicePdf({
      number: invoice.number,
      date: formatShortDate(invoice.created_at.toISOString()),
      dueDate: invoice.due_date ? formatShortDate(invoice.due_date.toISOString()) : null,
      company: { name: team.name, siret: team.siret, address: team.address },
      client: { name: client.name, email: client.email, address: client.address },
      lines: invoice.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        total: l.quantity * l.unitPrice,
      })),
      totalHt: invoice.total_ht,
      totalTtc: invoice.total_ttc,
      tvaRate: invoice.tva_rate,
    });

    await updateInvoicePdfUrl({ teamId: input.teamId, invoiceId: invoice.id, pdfUrl });
    invoice.pdf_url = pdfUrl;
  }

  return toInvoiceView(invoice);
}
