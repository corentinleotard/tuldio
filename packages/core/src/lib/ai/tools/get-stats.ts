import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { getMonthlyStats } from '../../../modules/stats/index.js';

export const getStatsTool = defineTool({
  name: 'get_stats',
  description: `Get monthly business statistics: total revenue (invoiced HT/TTC), number of quotes sent vs accepted (conversion rate), outstanding unpaid invoices count and total, and new clients count.
Defaults to current month if the user says "mes stats" without specifying a period.
Returns a rich card displayed to the user — do not repeat all numbers in text, just highlight key insights.`,
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
