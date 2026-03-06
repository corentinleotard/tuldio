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
  description: z.string().min(1).max(500).describe('Description de la prestation'),
  quantity: z.number().positive().max(100_000).describe('Quantité'),
  unit: z.string().max(20).default('u').describe("Unité: u, m², m, h, forfait, kg, L, lot"),
  unitPrice: z.number().int().min(0).max(100_000_000).describe('Prix unitaire HT en centimes'),
  tvaRate: z.number().int().default(2000).describe('Taux TVA en points de base (2000=20%, 1000=10%, 550=5.5%, 0=exonéré)'),
});

const generateQuoteTool = defineTool({
  name: 'generate_quote',
  description:
    "Générer un devis pour un client. Montants en centimes. TVA par ligne en points de base (2000=20%, 1000=10%, 550=5.5%). IMPORTANT: utilise uniquement un clientId obtenu dans le contexte actuel de cette conversation.",
  schema: z.object({
    clientId: z.string().uuid().describe('ID du client (du contexte actuel uniquement)'),
    title: z.string().max(255).optional().describe('Titre/objet du devis (ex: Rénovation salle de bain)'),
    lines: z.array(lineSchema).min(1).max(50).describe('Lignes du devis'),
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
    "Modifier les lignes d'un devis existant (brouillon ou envoyé, sans facture liée). Remplace toutes les lignes.",
  schema: z.object({
    quoteId: z.string().uuid().describe('ID du devis (du contexte actuel uniquement)'),
    title: z.string().max(255).optional().describe('Nouveau titre (optionnel)'),
    lines: z.array(lineSchema).min(1).max(50).describe('Nouvelles lignes du devis (remplace les anciennes)'),
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
    "Générer une facture directe (sans devis). Montants en centimes. TVA par ligne. IMPORTANT: utilise uniquement un clientId obtenu dans le contexte actuel de cette conversation.",
  schema: z.object({
    clientId: z.string().uuid().describe('ID du client (du contexte actuel uniquement)'),
    title: z.string().max(255).optional().describe("Titre/objet de la facture"),
    lines: z.array(lineSchema).min(1).max(50).describe('Lignes de la facture'),
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
    "Modifier les lignes d'une facture existante (brouillon uniquement). Remplace toutes les lignes.",
  schema: z.object({
    invoiceId: z.string().uuid().describe('ID de la facture (du contexte actuel uniquement)'),
    title: z.string().max(255).optional().describe('Nouveau titre (optionnel)'),
    lines: z.array(lineSchema).min(1).max(50).describe('Nouvelles lignes de la facture (remplace les anciennes)'),
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
    "Facturer un devis existant. Copie les lignes du devis dans une facture liée. Utiliser quand l'utilisateur dit 'facture le devis X'.",
  schema: z.object({
    quoteId: z.string().uuid().describe('ID du devis (du contexte actuel uniquement)'),
    title: z.string().max(255).optional().describe("Titre de la facture (par défaut: reprend le titre du devis)"),
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
  description:
    "Lister les devis. Optionnel: filtrer par clientId du contexte actuel.",
  schema: z.object({
    clientId: z.string().uuid().optional().describe('Filtrer par client (du contexte actuel, optionnel)'),
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
  description:
    "Lister les factures. Optionnel: filtrer par clientId du contexte actuel.",
  schema: z.object({
    clientId: z.string().uuid().optional().describe('Filtrer par client (du contexte actuel, optionnel)'),
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
  description: 'Obtenir les statistiques du mois (CA, factures impayées, conversion devis).',
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
    invoiceId: z.string().uuid().describe('ID de la facture (du contexte actuel uniquement)'),
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
    "Mettre à jour les informations d'un client existant (email, téléphone, adresse, nom). IMPORTANT: utilise uniquement un clientId obtenu dans le contexte actuel.",
  schema: z.object({
    clientId: z.string().uuid().describe('ID du client (du contexte actuel uniquement)'),
    firstName: z.string().min(1).max(100).optional().describe('Nouveau prénom'),
    lastName: z.string().min(1).max(100).optional().describe('Nouveau nom'),
    email: z.string().email().optional().describe('Nouvel email'),
    phone: z.string().max(30).optional().describe('Nouveau téléphone'),
    address: z.string().max(500).optional().describe('Nouvelle adresse'),
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
  description: "Ajouter une note à un client. IMPORTANT: utilise uniquement un clientId obtenu dans le contexte actuel. Utilise type 'warning' pour les informations de sécurité ou d'accès importantes (animal dangereux, code portail, accès difficile, précautions chantier…). Sinon 'note' par défaut.",
  schema: z.object({
    clientId: z.string().uuid().describe('ID du client (du contexte actuel uniquement)'),
    content: z.string().min(1).max(2000).describe('Contenu de la note'),
    type: z.enum(['note', 'warning']).default('note').describe("'warning' pour sécurité/accès, 'note' sinon"),
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
