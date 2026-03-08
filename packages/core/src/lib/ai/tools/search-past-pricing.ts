import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { searchPastPricing } from '../../../modules/quotes/index.js';

export const searchPastPricingTool = defineTool({
  name: 'search_past_pricing',
  description:
    `Search past quotes and invoices for similar line descriptions to find previously used pricing.
Returns matching lines with unit price, quantity, document info, and date.`,
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
