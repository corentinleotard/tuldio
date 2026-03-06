import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { resolveClient, createClient, addClientNote } from '../../modules/clients/index.js';
import { createQuote } from '../../modules/quotes/index.js';
import { createInvoice, markAsPaid } from '../../modules/invoices/index.js';
import { createExpense } from '../../modules/expenses/index.js';
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
    "Rechercher un client par nom, email ou téléphone. TOUJOURS utiliser cet outil avant de créer un devis ou une facture pour identifier le bon client. Retourne les correspondances trouvées.",
  schema: z.object({
    search: z.string().min(1).max(200).describe(
      "Texte de recherche libre (nom, prénom, ou les deux). Ignorer les civilités (M., Mme, Monsieur, Madame).",
    ),
    email: z.string().email().optional().describe('Email du client si mentionné'),
    phone: z.string().max(30).optional().describe('Téléphone du client si mentionné'),
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
    "Créer un nouveau client. OBLIGATOIRE: prénom et nom. Ne JAMAIS créer sans avoir d'abord utilisé resolve_client pour vérifier les doublons.",
  schema: z.object({
    firstName: z.string().min(1).max(100).describe('Prénom du client'),
    lastName: z.string().min(1).max(100).describe('Nom de famille du client'),
    email: z.string().email().optional().describe('Email du client'),
    phone: z.string().max(30).optional().describe('Téléphone du client'),
    address: z.string().max(500).optional().describe('Adresse complète du client'),
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
  description: z.string().min(1).max(500).describe('Description de la ligne'),
  quantity: z.number().positive().max(100_000).describe('Quantité'),
  unitPrice: z.number().int().min(0).max(100_000_000).describe('Prix unitaire en centimes'),
});

const documentSchema = z.object({
  clientId: z.string().uuid().describe('ID du client (obtenu via resolve_client)'),
  lines: z.array(lineSchema).min(1).max(50).describe('Lignes du document'),
  tvaRate: z.number().min(0).max(100).describe('Taux de TVA en pourcentage (ex: 20)'),
});

const generateQuoteTool = defineTool({
  name: 'generate_quote',
  description:
    'Générer un devis pour un client. Montants en centimes. Requiert un clientId validé via resolve_client.',
  schema: documentSchema,
  handler: async (args, ctx) => {
    const quote = await createQuote({
      teamId: ctx.teamId,
      userId: ctx.userId,
      clientId: args.clientId,
      lines: args.lines,
      tvaRate: args.tvaRate,
    });
    return { result: quote, richCard: { type: 'quote', data: quote } };
  },
});

const generateInvoiceTool = defineTool({
  name: 'generate_invoice',
  description:
    'Générer une facture pour un client. Montants en centimes. Requiert un clientId validé via resolve_client.',
  schema: documentSchema,
  handler: async (args, ctx) => {
    const invoice = await createInvoice({
      teamId: ctx.teamId,
      userId: ctx.userId,
      clientId: args.clientId,
      lines: args.lines,
      tvaRate: args.tvaRate,
    });
    return { result: invoice, richCard: { type: 'invoice', data: invoice } };
  },
});

const recordExpenseTool = defineTool({
  name: 'record_expense',
  description: 'Enregistrer une dépense. Montant en centimes.',
  schema: z.object({
    amount: z.number().int().positive().max(100_000_000).describe('Montant en centimes'),
    category: z.string().max(100).optional().describe('Catégorie de la dépense'),
    vendor: z.string().min(1).max(200).describe('Nom du fournisseur'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).describe('Date au format YYYY-MM-DD'),
  }),
  handler: async (args, ctx) => {
    const expense = await createExpense({
      teamId: ctx.teamId,
      userId: ctx.userId,
      amount: args.amount,
      category: args.category ?? 'autre',
      vendor: args.vendor,
      date: new Date(args.date),
    });
    return { result: expense, richCard: { type: 'expense', data: expense } };
  },
});

const getStatsTool = defineTool({
  name: 'get_stats',
  description: 'Obtenir les statistiques du mois.',
  schema: z.object({
    month: z.number().int().min(1).max(12).describe('Mois (1-12)'),
    year: z.number().int().min(2020).max(2100).describe('Année'),
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
  description: 'Marquer une facture comme payée.',
  schema: z.object({
    invoiceId: z.string().uuid().describe('ID de la facture à marquer comme payée'),
  }),
  handler: async (args, ctx) => {
    const invoice = await markAsPaid({
      teamId: ctx.teamId,
      invoiceId: args.invoiceId,
    });
    return { result: invoice };
  },
});

const addClientNoteTool = defineTool({
  name: 'add_client_note',
  description: 'Ajouter une note à un client.',
  schema: z.object({
    clientId: z.string().uuid().describe('ID du client'),
    content: z.string().min(1).max(2000).describe('Contenu de la note'),
  }),
  handler: async (args, ctx) => {
    await addClientNote({
      teamId: ctx.teamId,
      clientId: args.clientId,
      content: args.content,
    });
    return { result: { success: true } };
  },
});

// --- Registry ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allTools: ToolDefinition<any>[] = [
  resolveClientTool,
  createClientTool,
  generateQuoteTool,
  generateInvoiceTool,
  recordExpenseTool,
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
