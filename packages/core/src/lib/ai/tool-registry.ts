import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { resolveClient, createClient, addClientNote, updateClientUc } from '../../modules/clients/index.js';
import { createQuote, updateQuote, listQuotes } from '../../modules/quotes/index.js';
import { createInvoice, updateInvoice, createInvoiceFromQuote, markAsPaid, listInvoices } from '../../modules/invoices/index.js';
import { getMonthlyStats } from '../../modules/stats/index.js';

export type ToolResult = { result: unknown; richCard?: { type: string; data: unknown } };

type ToolContext = { teamId: string; userId: string };

interface ToolDefinition<T extends z.ZodType> {
  name: string;
  description: string;
  schema: T;
  handler: (args: z.infer<T>, ctx: ToolContext) => Promise<ToolResult>;
}

function defineTool<T extends z.ZodType>(def: ToolDefinition<T>): ToolDefinition<T> {
  return def;
}

// --- Tool definitions ---

const resolveClientTool = defineTool({
  name: 'resolve_client',
  description:
    `Search for an existing client by name, email, or phone. MUST be called before creating any quote or invoice.
Returns one of:
- exact_match: one client found — confirm with the user before proceeding ("Je pars sur [name] ?")
- ambiguous (< 3 results): a client picker card will appear — ask "J'ai trouvé plusieurs clients, lequel est-ce ?"
- ambiguous (>= 3 results): list names with details (phone, email, address) and ask the user to clarify
- no_match: no client found — propose to create one ("Je ne connais pas ce client. Je le crée ?")
Strip civilities (M., Mme, Monsieur, Madame) from the search text.`,
  schema: z.object({
    search: z.string().min(1).max(200).describe(
      "Free text search (first name, last name, or both). Strip civilities (M., Mme, Monsieur, Madame).",
    ),
    email: z.string().email().optional().describe('Client email if mentioned'),
    phone: z.string().max(30).optional().describe('Client phone if mentioned'),
  }),
  handler: async (args, ctx) => {
    const resolution = await resolveClient({
      teamId: ctx.teamId,
      search: args.search,
      email: args.email,
      phone: args.phone,
    });

    if (resolution.status === 'exact_match') {
      return { result: resolution };
    }

    if (resolution.status === 'ambiguous' && resolution.candidates.length < 3) {
      return {
        result: resolution,
        richCard: { type: 'client_picker', data: resolution.candidates },
      };
    }

    return { result: resolution };
  },
});

const createClientTool = defineTool({
  name: 'create_client',
  description:
    `Create a new client. Requires first name and last name.
NEVER create a client without first searching for duplicates.
After creation, encourage the user to provide email/phone if missing: "Tu as son email ou telephone ? C'est utile pour le retrouver facilement."`,
  schema: z.object({
    firstName: z.string().min(1).max(100).describe('Client first name'),
    lastName: z.string().min(1).max(100).describe('Client last name'),
    email: z.string().email().optional().describe('Client email'),
    phone: z.string().max(30).optional().describe('Client phone'),
    address: z.string().max(500).optional().describe('Client full address'),
  }),
  handler: async (args, ctx) => {
    const client = await createClient({
      teamId: ctx.teamId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      address: args.address,
    });
    return { result: client };
  },
});

const lineSchema = z.object({
  description: z.string().min(1).max(500).describe('Line item description'),
  quantity: z.number().positive().max(100_000).describe('Quantity'),
  unit: z.string().max(20).default('u').describe('Unit: u, m2, m, h, forfait, kg, L, lot'),
  unitPrice: z.number().int().min(0).max(100_000_000).describe('Unit price excl. tax in cents'),
  tvaRate: z.number().int().default(2000).describe('VAT rate in basis points (2000=20%, 1000=10%, 550=5.5%, 0=exempt)'),
});

const generateQuoteTool = defineTool({
  name: 'generate_quote',
  description:
    `Generate a new quote for a client. Amounts in cents, VAT per line in basis points (2000=20%, 1000=10%, 550=5.5%, 0=exempt).
Always confirm line items and amounts with the user before calling this tool.
Add a descriptive title (e.g. "Renovation salle de bain").
Use the appropriate unit per line: m2, m, h, forfait, u, kg, L, lot.`,
  schema: z.object({
    clientId: z.string().uuid().describe('Client ID (from current conversation tool results only)'),
    title: z.string().max(255).optional().describe('Quote title/subject'),
    lines: z.array(lineSchema).min(1).max(50).describe('Quote line items'),
  }),
  handler: async (args, ctx) => {
    const quote = await createQuote({
      teamId: ctx.teamId,
      userId: ctx.userId,
      clientId: args.clientId,
      title: args.title,
      lines: args.lines,
    });
    return { result: quote, richCard: { type: 'quote', data: quote } };
  },
});

const updateQuoteTool = defineTool({
  name: 'update_quote',
  description:
    `Update an existing quote (draft or sent, with no linked invoice). Replaces ALL lines — include unchanged lines too with the user's modifications applied.
Use this instead of generating a new quote when the user asks to modify an existing one.`,
  schema: z.object({
    quoteId: z.string().uuid().describe('Quote ID (from current conversation tool results only)'),
    title: z.string().max(255).optional().describe('New title (optional)'),
    lines: z.array(lineSchema).min(1).max(50).describe('New line items (replaces all existing lines)'),
  }),
  handler: async (args, ctx) => {
    const quote = await updateQuote({
      teamId: ctx.teamId,
      quoteId: args.quoteId,
      title: args.title,
      lines: args.lines,
    });
    return { result: quote, richCard: { type: 'quote', data: quote } };
  },
});

const generateInvoiceTool = defineTool({
  name: 'generate_invoice',
  description:
    `Generate a direct invoice (without a quote). Amounts in cents, VAT per line in basis points.
Use this for standalone invoices. To invoice from an existing quote, use the dedicated tool instead.`,
  schema: z.object({
    clientId: z.string().uuid().describe('Client ID (from current conversation tool results only)'),
    title: z.string().max(255).optional().describe('Invoice title/subject'),
    lines: z.array(lineSchema).min(1).max(50).describe('Invoice line items'),
  }),
  handler: async (args, ctx) => {
    const invoice = await createInvoice({
      teamId: ctx.teamId,
      userId: ctx.userId,
      clientId: args.clientId,
      title: args.title,
      lines: args.lines,
    });
    return { result: invoice, richCard: { type: 'invoice', data: invoice } };
  },
});

const updateInvoiceTool = defineTool({
  name: 'update_invoice',
  description:
    `Update an existing invoice (draft only). Replaces ALL lines.
Once sent, paid, or cancelled, an invoice cannot be modified — propose to cancel and recreate if needed.`,
  schema: z.object({
    invoiceId: z.string().uuid().describe('Invoice ID (from current conversation tool results only)'),
    title: z.string().max(255).optional().describe('New title (optional)'),
    lines: z.array(lineSchema).min(1).max(50).describe('New line items (replaces all existing lines)'),
  }),
  handler: async (args, ctx) => {
    const invoice = await updateInvoice({
      teamId: ctx.teamId,
      invoiceId: args.invoiceId,
      title: args.title,
      lines: args.lines,
    });
    return { result: invoice, richCard: { type: 'invoice', data: invoice } };
  },
});

const invoiceFromQuoteTool = defineTool({
  name: 'invoice_from_quote',
  description:
    `Create an invoice from an existing quote. Copies all lines from the quote into a linked invoice.
Use when the user says "facture le devis X". Confirm before invoicing: "Je facture la totalite du devis #X ?"
Use the list tool to find the quote if needed.`,
  schema: z.object({
    quoteId: z.string().uuid().describe('Quote ID (from current conversation tool results only)'),
    title: z.string().max(255).optional().describe('Invoice title (defaults to quote title)'),
  }),
  handler: async (args, ctx) => {
    const invoice = await createInvoiceFromQuote({
      teamId: ctx.teamId,
      userId: ctx.userId,
      quoteId: args.quoteId,
      title: args.title,
    });
    return { result: invoice, richCard: { type: 'invoice', data: invoice } };
  },
});

const listQuotesTool = defineTool({
  name: 'list_quotes',
  description: 'List recent quotes. Optionally filter by client.',
  schema: z.object({
    clientId: z.string().uuid().optional().describe('Filter by client ID (from current conversation, optional)'),
  }),
  handler: async (args, ctx) => {
    const quotes = await listQuotes(ctx.teamId);
    const filtered = args.clientId
      ? quotes.filter((q) => q.clientId === args.clientId)
      : quotes;
    return { result: filtered.slice(0, 10) };
  },
});

const listInvoicesTool = defineTool({
  name: 'list_invoices',
  description: 'List recent invoices. Optionally filter by client.',
  schema: z.object({
    clientId: z.string().uuid().optional().describe('Filter by client ID (from current conversation, optional)'),
  }),
  handler: async (args, ctx) => {
    const invoices = await listInvoices(ctx.teamId);
    const filtered = args.clientId
      ? invoices.filter((inv) => inv.clientId === args.clientId)
      : invoices;
    return { result: filtered.slice(0, 10) };
  },
});

const getStatsTool = defineTool({
  name: 'get_stats',
  description: 'Get monthly business statistics (revenue, unpaid invoices, quote conversion rate).',
  schema: z.object({
    month: z.number().int().min(1).max(12).describe('Month (1-12)'),
    year: z.number().int().min(2020).max(2100).describe('Year'),
  }),
  handler: async (args, ctx) => {
    const stats = await getMonthlyStats({
      teamId: ctx.teamId,
      month: args.month,
      year: args.year,
    });
    return { result: stats, richCard: { type: 'stats', data: stats } };
  },
});

const markAsPaidTool = defineTool({
  name: 'mark_as_paid',
  description: 'Mark an invoice as paid.',
  schema: z.object({
    invoiceId: z.string().uuid().describe('Invoice ID (from current conversation tool results only)'),
  }),
  handler: async (args, ctx) => {
    const invoice = await markAsPaid({
      teamId: ctx.teamId,
      invoiceId: args.invoiceId,
    });
    return { result: invoice };
  },
});

const updateClientTool = defineTool({
  name: 'update_client',
  description:
    `Update an existing client's information (email, phone, address, name).
Use when the user provides missing contact info (e.g. after a document email flow fails because the client has no email).`,
  schema: z.object({
    clientId: z.string().uuid().describe('Client ID (from current conversation tool results only)'),
    firstName: z.string().min(1).max(100).optional().describe('New first name'),
    lastName: z.string().min(1).max(100).optional().describe('New last name'),
    email: z.string().email().optional().describe('New email'),
    phone: z.string().max(30).optional().describe('New phone'),
    address: z.string().max(500).optional().describe('New address'),
  }),
  handler: async (args, ctx) => {
    const client = await updateClientUc({
      teamId: ctx.teamId,
      clientId: args.clientId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      address: args.address,
    });
    return { result: client };
  },
});

const addClientNoteTool = defineTool({
  name: 'add_client_note',
  description:
    `Add a note to a client. Use type 'warning' for safety/access info (dangerous animal, gate code, difficult access, site precautions). Default is 'note'.`,
  schema: z.object({
    clientId: z.string().uuid().describe('Client ID (from current conversation tool results only)'),
    content: z.string().min(1).max(2000).describe('Note content'),
    type: z.enum(['note', 'warning']).default('note').describe("'warning' for safety/access, 'note' otherwise"),
  }),
  handler: async (args, ctx) => {
    await addClientNote({
      teamId: ctx.teamId,
      clientId: args.clientId,
      content: args.content,
      type: args.type,
    });
    return { result: { success: true } };
  },
});

// --- Registry ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allTools: ToolDefinition<any>[] = [
  resolveClientTool,
  createClientTool,
  updateClientTool,
  generateQuoteTool,
  updateQuoteTool,
  listQuotesTool,
  generateInvoiceTool,
  updateInvoiceTool,
  invoiceFromQuoteTool,
  listInvoicesTool,
  getStatsTool,
  markAsPaidTool,
  addClientNoteTool,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toolMap = new Map<string, ToolDefinition<any>>(
  allTools.map((t) => [t.name, t]),
);

/** Claude API tool definitions — derived from zod schemas */
export const chatTools: Anthropic.Tool[] = allTools.map((t) => {
  const { $schema: _, ...jsonSchema } = zodToJsonSchema(t.schema, { target: 'jsonSchema7' });
  return {
    name: t.name,
    description: t.description,
    input_schema: jsonSchema as Anthropic.Tool['input_schema'],
  };
});

/** Execute a tool by name — validates input with zod, then runs handler */
export async function executeTool(input: {
  toolName: string;
  toolInput: Record<string, unknown>;
  teamId: string;
  userId: string;
}): Promise<ToolResult> {
  const tool = toolMap.get(input.toolName);

  if (!tool) {
    return { result: { error: `Unknown tool: ${input.toolName}` } };
  }

  const args = tool.schema.parse(input.toolInput);
  return tool.handler(args, { teamId: input.teamId, userId: input.userId });
}
