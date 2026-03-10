import type Anthropic from '@anthropic-ai/sdk';
import type { DemandState, Message } from '@tuldio/types';

const RECENT_MESSAGES_COUNT = 8;
export const DETECTION_MESSAGES_COUNT = 5;

export type StoredToolCall = {
  toolUseId: string;
  name: string;
  input: unknown;
  result: unknown;
};

/** Stored as `toolCalls` on assistant messages — array of rounds, each round is an array of tool calls */
export type StoredToolRounds = StoredToolCall[][];

/**
 * Build the Claude message array from the last N stored messages.
 * For assistant messages that have tool rounds, reconstruct the full
 * tool_use / tool_result exchange so Claude sees structured tool data.
 */
export function buildClaudeMessages(allMessages: Message[], options?: { limit?: number }): Anthropic.MessageParam[] {
  const count = options?.limit ?? RECENT_MESSAGES_COUNT;
  // Take the last N messages, ensuring the slice starts with a user message
  // to avoid orphaned tool_result blocks after tool round expansion.
  let startIndex = Math.max(0, allMessages.length - count);
  while (startIndex > 0 && allMessages[startIndex]!.role !== 'user') {
    startIndex--;
  }
  // If even index 0 is not a user message, skip forward to the first user message
  while (startIndex < allMessages.length && allMessages[startIndex]!.role !== 'user') {
    startIndex++;
  }
  const recent = allMessages.slice(startIndex);

  const claudeMessages: Anthropic.MessageParam[] = [];

  for (const msg of recent) {
    if (msg.role === 'user') {
      claudeMessages.push({ role: 'user', content: msg.content });
      continue;
    }

    // Assistant message — check for stored tool rounds
    const toolRounds = msg.toolCalls as StoredToolRounds | null;

    if (!toolRounds || toolRounds.length === 0) {
      // Plain text assistant message (no tools were called)
      claudeMessages.push({ role: 'assistant', content: msg.content });
      continue;
    }

    // Reconstruct tool_use / tool_result blocks per round
    for (const round of toolRounds) {
      if (round.length === 0) continue;

      // Assistant message with tool_use blocks
      const toolUseBlocks: Anthropic.ContentBlockParam[] = round.map((tc) => ({
        type: 'tool_use' as const,
        id: tc.toolUseId,
        name: tc.name,
        input: tc.input as Record<string, unknown>,
      }));
      claudeMessages.push({ role: 'assistant', content: toolUseBlocks });

      // User message with tool_result blocks
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = round.map((tc) => ({
        type: 'tool_result' as const,
        tool_use_id: tc.toolUseId,
        content: JSON.stringify(tc.result),
      }));
      claudeMessages.push({ role: 'user', content: toolResultBlocks });
    }

    // Final text response after all tool rounds
    if (msg.content) {
      claudeMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  return claudeMessages;
}

/**
 * Build a synthetic context message pair for the dynamic state.
 * Injected at the start of the conversation AFTER delimiting,
 * so it is NOT wrapped in <user_message> tags.
 */
export function buildContextMessages(input: {
  demandState: DemandState;
  clientNotFound: string | null;
}): Anthropic.MessageParam[] {
  const { client, document: docPointer, pendingCandidates } = input.demandState;

  let context = '';

  if (client) {
    context += `Client actif : ${client.name}\n`;
  }

  if (docPointer) {
    const typeLabel = docPointer.type === 'quote' ? 'Devis' : 'Facture';
    context += `Document actif : ${typeLabel} (${docPointer.type}). Utilise get_active_document pour voir les lignes.\n`;
  }

  if (pendingCandidates && pendingCandidates.length > 0) {
    context += 'Candidats en attente (demande au user de choisir) :\n';
    for (const c of pendingCandidates) {
      context += `- ${c.name}\n`;
    }
  }

  if (input.clientNotFound) {
    context += `Client introuvable : "${input.clientNotFound}" n'existe pas. Si le user veut agir pour cette personne, appelle create_client directement sans confirmation.\n`;
  }

  return [
    { role: 'user', content: `<context>\n${context.trim()}\n</context>` },
    { role: 'assistant', content: 'Compris.' },
  ];
}
