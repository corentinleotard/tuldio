import type Anthropic from '@anthropic-ai/sdk';
import type { ActiveState, Message } from '@tuldio/common';
import { migrateStoredToolCall, type StoredRef } from './ref-map.js';

const RECENT_MESSAGES_COUNT = 8;

export type StoredToolCall = {
  toolUseId: string;
  name: string;
  input: unknown;
  result: unknown;
  refs?: StoredRef[];
};

/** Stored as `toolCalls` on assistant messages — array of rounds, each round is an array of tool calls */
export type StoredToolRounds = StoredToolCall[][];

/**
 * Build the Claude message array from the last N stored messages.
 * For assistant messages that have tool rounds, reconstruct the full
 * tool_use / tool_result exchange so Claude sees structured tool data.
 * Old-format tool calls are migrated on the fly via migrateStoredToolCall.
 */
/** Compute the start index for the recent message window (last N, starting from a user message). */
function getRecentWindowStart(allMessages: Message[], count: number): number {
  let startIndex = Math.max(0, allMessages.length - count);
  while (startIndex > 0 && allMessages[startIndex]!.role !== 'user') {
    startIndex--;
  }
  // If even index 0 is not a user message, skip forward to the first user message
  while (startIndex < allMessages.length && allMessages[startIndex]!.role !== 'user') {
    startIndex++;
  }
  return startIndex;
}

export function buildClaudeMessages(allMessages: Message[], options?: { limit?: number }): Anthropic.MessageParam[] {
  const count = options?.limit ?? RECENT_MESSAGES_COUNT;
  const recent = allMessages.slice(getRecentWindowStart(allMessages, count));

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

      // Migrate old-format tool calls on the fly
      const migratedRound = round.map(migrateStoredToolCall);

      // Skip rounds with only obsolete tools
      const validCalls = migratedRound.filter((tc) => tc.name !== 'detect_client');
      if (validCalls.length === 0) continue;

      // Assistant message with tool_use blocks
      const toolUseBlocks: Anthropic.ContentBlockParam[] = validCalls.map((tc) => ({
        type: 'tool_use' as const,
        id: tc.toolUseId,
        name: tc.name,
        input: tc.input as Record<string, unknown>,
      }));
      claudeMessages.push({ role: 'assistant', content: toolUseBlocks });

      // User message with tool_result blocks
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = validCalls.map((tc) => ({
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
 * Extract stored tool calls from the same message window Claude sees.
 * Returns a flat array in chronological order.
 */
export function extractStoredToolCalls(allMessages: Message[]): StoredToolCall[] {
  const recent = allMessages.slice(getRecentWindowStart(allMessages, RECENT_MESSAGES_COUNT));
  const result: StoredToolCall[] = [];
  for (const msg of recent) {
    if (msg.role !== 'assistant') continue;
    const toolRounds = msg.toolCalls as StoredToolRounds | null;
    if (!toolRounds) continue;
    for (const round of toolRounds) {
      for (const tc of round) {
        result.push(migrateStoredToolCall(tc));
      }
    }
  }
  return result;
}

/**
 * Build lightweight active state context lines.
 * Injected as a synthetic user+assistant pair at the start of conversation.
 */
export function buildContextMessages(input: {
  activeState: ActiveState;
  clientRef: string | null;
  documentRef: string | null;
}): Anthropic.MessageParam[] {
  const { client, document: doc } = input.activeState;

  let context = '';

  if (client && input.clientRef) {
    context += `Client actif : ${input.clientRef} = ${client.name}\n`;
  }

  if (doc && input.documentRef) {
    const typeLabel = doc.type === 'quote' ? 'Devis' : 'Facture';
    context += `Document actif : ${input.documentRef} = ${typeLabel} ${doc.number}\n`;
  }

  if (!context) return [];

  return [
    { role: 'user', content: context.trim() },
    { role: 'assistant', content: 'Compris.' },
  ];
}
