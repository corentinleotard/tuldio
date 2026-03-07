import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { searchPastPricing } from '../../../modules/quotes/index.js';

export const searchPastPricingTool = defineTool({
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
    const hasMatches = Array.isArray(results) && results.length > 0;
    return { result: results, ...(hasMatches ? { quickReplies: ['Oui, même prix'] } : {}) };
  },
});
