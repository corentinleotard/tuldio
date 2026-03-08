import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { getMonthlyStats } from '../../../modules/stats/index.js';

export const getStatsTool = defineTool({
  name: 'get_stats',
  description: `Get monthly business statistics (revenue, unpaid invoices, quote conversion rate).`,
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
