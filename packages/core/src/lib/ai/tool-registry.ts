import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { DemandState, DemandDocument } from '@tuldio/types';
import { resolveClient, createClient, addClientNote, updateClientUc } from '../../modules/clients/index.js';
import { createQuote, updateQuote, listQuotes, searchPastPricing } from '../../modules/quotes/index.js';
import { createInvoice, updateInvoice, createInvoiceFromQuote, markAsPaid, listInvoices } from '../../modules/invoices/index.js';
import { getMonthlyStats } from '../../modules/stats/index.js';
import { HandledError } from '../errors/handled-error.js';
import { errorCodes } from '../errors/error-codes.js';
import { resolveUnit } from '../../modules/units/index.js';

export type ToolResult = { result: unknown; richCard?: { type: string; data: unknown }; quickReplies?: string[] };

export type StateUpdate = Partial<DemandState> | 'clear' | null;

type ToolContext = { teamId: string; userId: string; demandState: DemandState };

interface ToolDefinition<T extends z.ZodType> {
  name: string;
  description: string;
  schema: T;
  handler: (args: z.infer<T>, ctx: ToolContext) => Promise<ToolResult>;
  stateUpdate?: (result: unknown, ctx: ToolContext) => StateUpdate;
}

function defineTool<T extends z.ZodType>(def: ToolDefinition<T>): ToolDefinition<T> {
  return def;
}

// --- Shared schemas ---

const lineSchema = z.object({
  description: z.string().min(1).max(500).describe('Line item description'),
  quantity: z.number().positive().max(100_000).describe('Quantity'),
  unit: z.string().max(50).default('u').describe('Unit of measure (e.g. u, m2, m, h, forfait, kg, L, lot, t, sac, palette, rouleau, etc.)'),
  unitPrice: z.number().int().min(0).max(100_000_000).describe('Unit price excl. tax in cents'),
  tvaRate: z.number().int().default(2000).describe('VAT rate in basis points'),
});

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
  stateUpdate: (result) => {
    const r = result as { status: string; client?: { id: string; firstName: string; lastName: string } };
    if (r.status === 'exact_match' && r.client) {
      return { client: { id: r.client.id, name: `${r.client.firstName} ${r.client.lastName}` }, document: null };
    }
    return null;
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
  stateUpdate: (result) => {
    const r = result as { id: string; firstName: string; lastName: string };
    return { client: { id: r.id, name: `${r.firstName} ${r.lastName}` }, document: null };
  },
});

const searchPastPricingTool = defineTool({
  name: 'search_past_pricing',
  description:
    `Search past quotes and invoices for similar line items to find previously used pricing.
Use PROACTIVELY: when the user provides line descriptions for a new document, search each description BEFORE asking for unit prices. If matches are found, suggest the most recent price: "La derniere fois tu as facture [description] a X€/[unit]. Je pars la-dessus ?"
Also use when the user explicitly asks about past pricing, rates, or what they charged before.
Returns matching lines with unit price, quantity, document type/number, client, and date.`,
  schema: z.object({
    search: z.string().min(1).max(200).describe('Line description to search for (e.g. "terrassement", "polyane", "carrelage")'),
  }),
  handler: async (args, ctx) => {
    const results = await searchPastPricing({
      teamId: ctx.teamId,
      search: args.search,
    });
    return { result: results };
  },
});

const initDocumentTool = defineTool({
  name: 'init_document',
  description:
    `Initialize a new document (quote or invoice). Call this ONCE at the start of a document creation flow.
Sets the document type, optional title, and TVA context. Lines are added separately with add_lines.
If a document is already in progress, this REPLACES it (clears existing lines).
If the user does not specify TVA context, ask: "C'est de la réno ou du neuf ? Pour la TVA." Then apply French construction VAT rules per line type.
Do NOT call this if a generatedId already exists in state — use update_quote/update_invoice instead.`,
  schema: z.object({
    type: z.enum(['quote', 'invoice']).describe('Document type'),
    title: z.string().max(255).optional().describe('Document title'),
    tvaContext: z.enum(['réno', 'neuf']).optional().describe('TVA context — réno or neuf'),
  }),
  handler: async (args) => {
    return {
      result: {
        type: args.type,
        title: args.title,
        tvaContext: args.tvaContext,
        lineCount: 0,
      },
    };
  },
  stateUpdate: (result) => {
    const r = result as { type: string; title?: string; tvaContext?: string };
    return {
      document: {
        type: r.type,
        title: r.title,
        tvaContext: r.tvaContext,
        lines: [],
      } as DemandDocument,
    };
  },
});

const addLinesTool = defineTool({
  name: 'add_lines',
  description:
    `Add one or more lines to the current document. Call init_document first.
Lines are appended to the existing list — never replaces. Prices and TVA can be omitted and set later with update_line.
Call this once with all lines the user mentioned, or multiple times as the user adds more.`,
  schema: z.object({
    lines: z.array(z.object({
      description: z.string().min(1).max(500).describe('Line item description'),
      quantity: z.number().positive().max(100_000).describe('Quantity'),
      unit: z.string().max(50).default('u').describe('Unit of measure (e.g. u, m2, m, h, forfait, kg, L, lot, t, sac, palette, etc.)'),
      unitPrice: z.number().int().min(0).max(100_000_000).optional().describe('Unit price excl. tax in cents — omit if not yet known'),
      tvaRate: z.number().int().optional().describe('VAT rate in basis points (2000=20%, 1000=10%, 550=5.5%) — omit if not yet determined'),
    })).min(1).max(50).describe('Lines to add'),
  }),
  handler: async (args, ctx) => {
    if (!ctx.demandState.document) {
      throw new HandledError(errorCodes.noDocumentPrepared);
    }
    const doc = ctx.demandState.document;
    const resolvedLines = await Promise.all(
      args.lines.map(async (l) => {
        const resolved = await resolveUnit({ teamId: ctx.teamId, raw: l.unit });
        return { ...l, unit: resolved.label };
      }),
    );
    const newLines = [...doc.lines, ...resolvedLines];
    const allPriced = newLines.every((l) => l.unitPrice !== undefined);
    return {
      result: {
        addedCount: resolvedLines.length,
        totalLineCount: newLines.length,
        allPriced,
        document: { ...doc, lines: newLines },
      },
    };
  },
  stateUpdate: (result) => {
    const r = result as { document: DemandDocument };
    return { document: r.document };
  },
});

const updateLineTool = defineTool({
  name: 'update_line',
  description:
    `Update one or more existing lines in the current document by their index (0-based, visible in the current demand state).
Use IMMEDIATELY when the user provides prices, quantities, or corrections for existing lines — do not ask for confirmation, just update.
Only include fields you want to change.`,
  schema: z.object({
    updates: z.array(z.object({
      index: z.number().int().min(0).describe('Line index (0-based, from current demand state)'),
      description: z.string().min(1).max(500).optional().describe('New description'),
      quantity: z.number().positive().max(100_000).optional().describe('New quantity'),
      unit: z.string().max(50).optional().describe('New unit of measure'),
      unitPrice: z.number().int().min(0).max(100_000_000).optional().describe('New unit price in cents'),
      tvaRate: z.number().int().optional().describe('New VAT rate in basis points'),
    })).min(1).max(50).describe('Line updates'),
  }),
  handler: async (args, ctx) => {
    if (!ctx.demandState.document) {
      throw new HandledError(errorCodes.noDocumentPrepared);
    }
    const doc = ctx.demandState.document;
    const lines = [...doc.lines];
    for (const update of args.updates) {
      if (update.index >= lines.length) {
        throw new HandledError(errorCodes.invalidInput);
      }
      const line = { ...lines[update.index]! };
      if (update.description !== undefined) line.description = update.description;
      if (update.quantity !== undefined) line.quantity = update.quantity;
      if (update.unit !== undefined) {
        const resolved = await resolveUnit({ teamId: ctx.teamId, raw: update.unit });
        line.unit = resolved.label;
      }
      if (update.unitPrice !== undefined) line.unitPrice = update.unitPrice;
      if (update.tvaRate !== undefined) line.tvaRate = update.tvaRate;
      lines[update.index] = line;
    }
    const allPriced = lines.every((l) => l.unitPrice !== undefined);
    return {
      result: {
        updatedCount: args.updates.length,
        totalLineCount: lines.length,
        allPriced,
        document: { ...doc, lines },
      },
    };
  },
  stateUpdate: (result) => {
    const r = result as { document: DemandDocument };
    return { document: r.document };
  },
});

const removeLineTool = defineTool({
  name: 'remove_line',
  description:
    `Remove a line from the current document by its index (0-based, visible in the current demand state).`,
  schema: z.object({
    index: z.number().int().min(0).describe('Line index to remove (0-based)'),
  }),
  handler: async (args, ctx) => {
    if (!ctx.demandState.document) {
      throw new HandledError(errorCodes.noDocumentPrepared);
    }
    const doc = ctx.demandState.document;
    if (args.index >= doc.lines.length) {
      throw new HandledError(errorCodes.invalidInput);
    }
    const lines = doc.lines.filter((_, i) => i !== args.index);
    const allPriced = lines.every((l) => l.unitPrice !== undefined);
    return {
      result: {
        removedIndex: args.index,
        totalLineCount: lines.length,
        allPriced,
        document: { ...doc, lines },
      },
    };
  },
  stateUpdate: (result) => {
    const r = result as { document: DemandDocument };
    return { document: r.document };
  },
});

const generateQuoteTool = defineTool({
  name: 'generate_quote',
  description:
    `Generate a quote from the current document and active client.
PREREQUISITES: resolve_client, init_document, and add_lines must have been called. All lines must have unitPrice set (use update_line if needed).
The client and lines are read from the current demand state — do not pass them.
Only for NEW quotes. If a generatedId already exists in state, the quote was already created — use update_quote instead.`,
  schema: z.object({
    title: z.string().max(255).optional().describe('Override title (uses init_document title if omitted)'),
  }),
  handler: async (args, ctx) => {
    const { demandState } = ctx;
    if (!demandState.client) throw new HandledError(errorCodes.noActiveClient);
    if (!demandState.document?.lines?.length) throw new HandledError(errorCodes.noDocumentPrepared);

    const incomplete = demandState.document.lines.some((l) => l.unitPrice === undefined);
    if (incomplete) throw new HandledError(errorCodes.documentLinesIncomplete);

    const quote = await createQuote({
      teamId: ctx.teamId,
      userId: ctx.userId,
      clientId: demandState.client.id,
      title: args.title ?? demandState.document.title,
      lines: demandState.document.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice!,
        tvaRate: l.tvaRate,
      })),
    });
    return { result: quote, richCard: { type: 'quote', data: quote } };
  },
  stateUpdate: (result, ctx) => {
    const r = result as { id: string };
    return { document: ctx.demandState.document ? { ...ctx.demandState.document, generatedId: r.id } : null };
  },
});

const updateQuoteTool = defineTool({
  name: 'update_quote',
  description:
    `Update an existing quote (draft or sent, with no linked invoice). Replaces ALL lines — include unchanged lines too with the user's modifications applied.
WHEN TO USE: when a generatedId exists in state or the user wants to modify a quote from conversation history.
Call this DIRECTLY with all lines (old + new/modified). Do NOT call add_lines/update_line first — this tool replaces everything in one step.`,
  schema: z.object({
    quoteId: z.string().uuid().describe('Quote ID (from current conversation tool results only)'),
    title: z.string().max(255).optional().describe('New title (optional)'),
    lines: z.array(lineSchema).min(1).max(50).describe('New line items (replaces all existing lines)'),
  }),
  handler: async (args, ctx) => {
    const resolvedLines = await Promise.all(
      args.lines.map(async (l) => {
        const resolved = await resolveUnit({ teamId: ctx.teamId, raw: l.unit });
        return { ...l, unit: resolved.label };
      }),
    );
    const quote = await updateQuote({
      teamId: ctx.teamId,
      quoteId: args.quoteId,
      title: args.title,
      lines: resolvedLines,
    });
    return { result: quote, richCard: { type: 'quote', data: quote } };
  },
  stateUpdate: (result, ctx) => {
    const r = result as { id: string; lines: Array<{ description: string; quantity: number; unit: string; unitPrice: number; tvaRate: number }> };
    const doc = ctx.demandState.document;
    if (!doc) return null;
    return {
      document: {
        ...doc,
        generatedId: r.id,
        lines: r.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          tvaRate: l.tvaRate,
        })),
      },
    };
  },
});

const generateInvoiceTool = defineTool({
  name: 'generate_invoice',
  description:
    `Generate an invoice from the current document and active client.
PREREQUISITES: resolve_client, init_document, and add_lines must have been called. All lines must have unitPrice set (use update_line if needed).
The client and lines are read from the current demand state — do not pass them.
Use this for standalone invoices. To invoice from an existing quote, use invoice_from_quote instead.
Only for NEW invoices. If a generatedId already exists in state, the invoice was already created — use update_invoice instead.`,
  schema: z.object({
    title: z.string().max(255).optional().describe('Override title (uses init_document title if omitted)'),
  }),
  handler: async (args, ctx) => {
    const { demandState } = ctx;
    if (!demandState.client) throw new HandledError(errorCodes.noActiveClient);
    if (!demandState.document?.lines?.length) throw new HandledError(errorCodes.noDocumentPrepared);

    const incomplete = demandState.document.lines.some((l) => l.unitPrice === undefined);
    if (incomplete) throw new HandledError(errorCodes.documentLinesIncomplete);

    const invoice = await createInvoice({
      teamId: ctx.teamId,
      userId: ctx.userId,
      clientId: demandState.client.id,
      title: args.title ?? demandState.document.title,
      lines: demandState.document.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice!,
        tvaRate: l.tvaRate,
      })),
    });
    return { result: invoice, richCard: { type: 'invoice', data: invoice } };
  },
  stateUpdate: (result, ctx) => {
    const r = result as { id: string };
    return { document: ctx.demandState.document ? { ...ctx.demandState.document, generatedId: r.id } : null };
  },
});

const updateInvoiceTool = defineTool({
  name: 'update_invoice',
  description:
    `Update an existing invoice (draft only). Replaces ALL lines — include unchanged lines too with the user's modifications applied.
Once sent, paid, or cancelled, an invoice cannot be modified — propose to cancel and recreate if needed.
WHEN TO USE: when a generatedId exists in state or the user wants to modify an invoice from conversation history.
Call this DIRECTLY with all lines (old + new/modified). Do NOT call add_lines/update_line first — this tool replaces everything in one step.`,
  schema: z.object({
    invoiceId: z.string().uuid().describe('Invoice ID (from current conversation tool results only)'),
    title: z.string().max(255).optional().describe('New title (optional)'),
    lines: z.array(lineSchema).min(1).max(50).describe('New line items (replaces all existing lines)'),
  }),
  handler: async (args, ctx) => {
    const resolvedLines = await Promise.all(
      args.lines.map(async (l) => {
        const resolved = await resolveUnit({ teamId: ctx.teamId, raw: l.unit });
        return { ...l, unit: resolved.label };
      }),
    );
    const invoice = await updateInvoice({
      teamId: ctx.teamId,
      invoiceId: args.invoiceId,
      title: args.title,
      lines: resolvedLines,
    });
    return { result: invoice, richCard: { type: 'invoice', data: invoice } };
  },
  stateUpdate: (result, ctx) => {
    const r = result as { id: string; lines: Array<{ description: string; quantity: number; unit: string; unitPrice: number; tvaRate: number }> };
    const doc = ctx.demandState.document;
    if (!doc) return null;
    return {
      document: {
        ...doc,
        generatedId: r.id,
        lines: r.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          tvaRate: l.tvaRate,
        })),
      },
    };
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
  searchPastPricingTool,
  initDocumentTool,
  addLinesTool,
  updateLineTool,
  removeLineTool,
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
  demandState: DemandState;
}): Promise<{ toolResult: ToolResult; stateUpdate: StateUpdate }> {
  const tool = toolMap.get(input.toolName);

  if (!tool) {
    return { toolResult: { result: { error: `Unknown tool: ${input.toolName}` } }, stateUpdate: null };
  }

  const args = tool.schema.parse(input.toolInput);
  const ctx = { teamId: input.teamId, userId: input.userId, demandState: input.demandState };
  const toolResult = await tool.handler(args, ctx);
  const stateUpdate = tool.stateUpdate ? tool.stateUpdate(toolResult.result, ctx) : null;

  return { toolResult, stateUpdate };
}
