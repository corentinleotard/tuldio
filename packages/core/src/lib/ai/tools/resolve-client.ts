import { z } from 'zod';
import { defineTool } from './define-tool.js';
import { resolveClient, type ClientResolution } from '../../../modules/clients/index.js';
import { shouldWipeDocument } from '../should-wipe-document.js';

type ResolveClientResult = ClientResolution & { intent: 'new' | 'switch_recipient' };

export const resolveClientTool = defineTool({
  name: 'resolve_client',
  description:
    `Search for an existing client by name, email, or phone. MUST be called before creating any quote or invoice.
Returns one of:
- exact_match: high-confidence match — proceed immediately with this client, no confirmation needed
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
    intent: z.enum(['new', 'switch_recipient']).default('new').describe(
      "Use 'new' when the user wants a new document for a different client. Use 'switch_recipient' when the user is correcting the client on the current draft (e.g. 'c'est pour Anna, pas Martin').",
    ),
  }),
  handler: async (args, ctx): Promise<{ result: ResolveClientResult; richCard?: { type: string; data: unknown }; quickReplies?: string[] }> => {
    const resolution = await resolveClient({
      teamId: ctx.teamId,
      search: args.search,
      email: args.email,
      phone: args.phone,
    });

    const result: ResolveClientResult = { ...resolution, intent: args.intent };

    if (resolution.status === 'exact_match') {
      return { result };
    }

    if (resolution.status === 'ambiguous' && resolution.candidates.length < 3) {
      return {
        result,
        richCard: { type: 'client_picker', data: resolution.candidates },
      };
    }

    if (resolution.status === 'no_match') {
      return { result, quickReplies: ['Oui, crée-le'] };
    }

    return { result };
  },
  stateUpdate: (result, ctx) => {
    if (result.status === 'exact_match' && result.client) {
      const wipe = shouldWipeDocument({
        document: ctx.demandState.document,
        currentClientId: ctx.demandState.client?.id ?? null,
        newClientId: result.client.id,
        intent: result.intent,
      });
      return {
        client: { id: result.client.id, name: `${result.client.firstName} ${result.client.lastName}` },
        ...(wipe ? { document: null } : {}),
      };
    }
    return null;
  },
});
