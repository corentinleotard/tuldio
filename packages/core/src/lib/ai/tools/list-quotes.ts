import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { listQuotes } from '../../../modules/quotes/index.js';

export const listQuotesTool = defineTool({
  name: 'list_quotes',
  description: 'List recent quotes. Optionally filter by client.',
  schema: z.object({
    clientId: z.string().uuid().optional().describe('Filter by client ID (from current conversation, optional)'),
  }),
  handler: async (args, ctx) => {
    const quotes = await listQuotes({ teamId: ctx.teamId, clientId: args.clientId, limit: 10 });
    return { result: quotes };
  },
});
