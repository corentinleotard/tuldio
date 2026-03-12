import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';
import { listQuotes } from '../../../modules/quotes/index.js';
import { listInvoices } from '../../../modules/invoices/index.js';

export const findDocumentsTool = defineTool({
  name: 'find_documents',
  description: `Search for quotes and/or invoices. Returns document refs with summary info (number, client, totals, status).
Use this when the user asks to find, review, or open a past document.
After finding, use get_document with the ref to see full details (lines, etc.).
Supports filtering by type, client ref, and status.`,
  schema: z.object({
    type: z.enum(['quote', 'invoice']).optional().describe('Filter by document type. Omit to search both.'),
    clientRef: z.string().optional().describe('Filter by client ref (from current conversation tool results only)'),
    status: z.enum(['draft', 'sent', 'accepted', 'refused', 'paid', 'overdue', 'cancelled']).optional().describe('Filter by status'),
    limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20)'),
  }),
  handler: async (args, ctx): Promise<ToolResult> => {
    const clientId = args.clientRef ? ctx.resolveRef(args.clientRef, 'client') : undefined;
    const limit = args.limit ?? 20;

    const formatDoc = (doc: { id: string; number: string; clientName?: string; title: string | null; totalHt: number; totalTtc: number; status: string; createdAt: string }, type: 'quote' | 'invoice') => {
      const ref = ctx.registerRef(type, doc.id);
      return {
        ref,
        type,
        number: doc.number,
        clientName: doc.clientName ?? null,
        title: doc.title,
        totalHt: doc.totalHt,
        totalTtc: doc.totalTtc,
        status: doc.status,
        createdAt: doc.createdAt,
      };
    };

    const statusFilter = args.status;
    const applyStatus = <T extends { status: string }>(docs: T[]): T[] =>
      statusFilter ? docs.filter((d) => d.status === statusFilter) : docs;

    if (args.type === 'quote') {
      const quotes = applyStatus(await listQuotes({ teamId: ctx.teamId, clientId, limit }));
      const documents = quotes.map((q) => formatDoc(q, 'quote'));
      return { result: { documents } };
    }
    if (args.type === 'invoice') {
      const invoices = applyStatus(await listInvoices({ teamId: ctx.teamId, clientId, limit }));
      const documents = invoices.map((i) => formatDoc(i, 'invoice'));
      return { result: { documents } };
    }

    const [quotes, invoices] = await Promise.all([
      listQuotes({ teamId: ctx.teamId, clientId, limit }),
      listInvoices({ teamId: ctx.teamId, clientId, limit }),
    ]);
    const documents = [
      ...applyStatus(quotes).map((q) => formatDoc(q, 'quote')),
      ...applyStatus(invoices).map((i) => formatDoc(i, 'invoice')),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
    return { result: { documents } };
  },
});
