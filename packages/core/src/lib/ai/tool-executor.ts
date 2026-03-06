import { searchClientsUc, createClient, addClientNote } from '../../modules/clients/index.js';
import { createQuote } from '../../modules/quotes/index.js';
import { createInvoice, markAsPaid } from '../../modules/invoices/index.js';
import { createExpense } from '../../modules/expenses/index.js';
import { getMonthlyStats } from '../../modules/stats/index.js';
import { logger } from '../infra/logger.js';

export async function executeTool(input: {
  toolName: string;
  toolInput: Record<string, unknown>;
  teamId: string;
  userId: string;
}): Promise<{ result: unknown; richCard?: { type: string; data: unknown } }> {
  const { toolName, toolInput, teamId, userId } = input;

  switch (toolName) {
    case 'search_clients': {
      const clients = await searchClientsUc({ teamId, search: toolInput.query as string });
      return { result: clients };
    }
    case 'create_client': {
      const client = await createClient({
        teamId,
        name: toolInput.name as string,
        email: toolInput.email as string | undefined,
        phone: toolInput.phone as string | undefined,
        address: toolInput.address as string | undefined,
      });
      return { result: client };
    }
    case 'generate_quote': {
      const quote = await createQuote({
        teamId,
        userId,
        clientId: toolInput.clientId as string,
        lines: toolInput.lines as { description: string; quantity: number; unitPrice: number }[],
        tvaRate: toolInput.tvaRate as number,
      });
      return {
        result: quote,
        richCard: { type: 'quote', data: quote },
      };
    }
    case 'generate_invoice': {
      const invoice = await createInvoice({
        teamId,
        userId,
        clientId: toolInput.clientId as string,
        lines: toolInput.lines as { description: string; quantity: number; unitPrice: number }[],
        tvaRate: toolInput.tvaRate as number,
      });
      return {
        result: invoice,
        richCard: { type: 'invoice', data: invoice },
      };
    }
    case 'record_expense': {
      const expense = await createExpense({
        teamId,
        userId,
        amount: toolInput.amount as number,
        category: (toolInput.category as string) ?? 'autre',
        vendor: toolInput.vendor as string,
        date: new Date(toolInput.date as string),
      });
      return {
        result: expense,
        richCard: { type: 'expense', data: expense },
      };
    }
    case 'get_stats': {
      const stats = await getMonthlyStats({
        teamId,
        month: toolInput.month as number,
        year: toolInput.year as number,
      });
      return {
        result: stats,
        richCard: { type: 'stats', data: stats },
      };
    }
    case 'mark_as_paid': {
      const invoice = await markAsPaid({
        teamId,
        invoiceId: toolInput.invoiceId as string,
      });
      return { result: invoice };
    }
    case 'add_client_note': {
      await addClientNote({
        teamId,
        clientId: toolInput.clientId as string,
        content: toolInput.content as string,
      });
      return { result: { success: true } };
    }
    default: {
      logger.warn(`Unknown tool: ${toolName}`);
      return { result: { error: `Unknown tool: ${toolName}` } };
    }
  }
}
