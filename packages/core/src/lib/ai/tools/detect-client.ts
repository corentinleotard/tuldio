import { z } from 'zod';
import { defineTool, type ToolResult } from './define-tool.js';

export const detectClientTool = defineTool({
  name: 'detect_client',
  description:
    `Analyze the user's latest message and extract any client reference.
Set clientMentioned to true if the user mentions a client by name, refers to a previous client ("le premier", "le deuxième"), or references a client in any way.
Set clientMentioned to false if the message has no client reference (e.g. "mes stats du mois", "supprime la dernière ligne", "15 euros").
If clientMentioned is true:
- If the user picks from pending candidates (e.g. "le premier", "celui-là", or a name matching a candidate), set clientId to the matching candidate's ID.
- Otherwise, set search to the client name/search term extracted from the message.`,
  schema: z.object({
    clientMentioned: z.boolean().describe('Whether the user references a client in their message'),
    search: z.string().min(1).max(200).optional().describe('Client name or search term extracted from the message'),
    clientId: z.string().uuid().optional().describe('Client ID picked from pending candidates (from current conversation tool results only)'),
  }),
  handler: async (args): Promise<ToolResult> => {
    // No-op: the orchestrator reads the structured output directly.
    return { result: args };
  },
});
