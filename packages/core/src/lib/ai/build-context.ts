import type Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@tuldio/types';

const RECENT_MESSAGES_COUNT = 4;

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
export function buildClaudeMessages(allMessages: Message[]): Anthropic.MessageParam[] {
  // Take the last N messages, ensuring the slice starts with a user message
  // to avoid orphaned tool_result blocks after tool round expansion.
  let startIndex = Math.max(0, allMessages.length - RECENT_MESSAGES_COUNT);
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
