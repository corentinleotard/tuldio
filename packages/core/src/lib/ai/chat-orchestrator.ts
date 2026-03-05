import type Anthropic from '@anthropic-ai/sdk';
import { callClaude } from './claude-client.js';
import { buildSystemPrompt } from './system-prompt.js';
import { chatTools } from './tools.js';
import { executeTool } from './tool-executor.js';
import { createMessage, listMessages } from '../../modules/messages/index.js';
import { getCurrentUser } from '../../modules/users/index.js';
import { getTeam } from '../../modules/teams/index.js';
import { logger } from '../infra/logger.js';
import type { Message } from '@tuldio/types';

export async function processMessage(input: {
  userId: string;
  teamId: string;
  content: string;
}): Promise<Message> {
  const { userId, teamId, content } = input;

  // Save user message
  await createMessage({ userId, teamId, role: 'user', content });

  // Load context
  const [user, team, recentMessages] = await Promise.all([
    getCurrentUser(userId),
    getTeam(teamId),
    listMessages({ userId, limit: 25 }),
  ]);

  const systemPrompt = buildSystemPrompt({
    teamName: team.name,
    userName: user.name,
  });

  // Build message history for Claude
  const claudeMessages: Anthropic.MessageParam[] = recentMessages.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // Call Claude with tools
  let response = await callClaude({
    systemPrompt,
    messages: claudeMessages,
    tools: chatTools,
  });

  let richCard: { type: string; data: unknown } | null = null;
  let toolCallsData: unknown = null;

  // Handle tool use loop
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      try {
        const result = await executeTool({
          toolName: toolUse.name,
          toolInput: toolUse.input as Record<string, unknown>,
          teamId,
          userId,
        });

        if (result.richCard) {
          richCard = result.richCard;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result.result),
        });
      } catch (err) {
        logger.error(`Tool execution failed: ${toolUse.name}`, { error: err });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            error: err instanceof Error ? err.message : 'Erreur interne',
          }),
          is_error: true,
        });
      }
    }

    toolCallsData = toolUseBlocks.map((b) => ({ name: b.name, input: b.input }));

    // Continue conversation with tool results
    claudeMessages.push({ role: 'assistant', content: response.content });
    claudeMessages.push({ role: 'user', content: toolResults });

    response = await callClaude({
      systemPrompt,
      messages: claudeMessages,
      tools: chatTools,
    });
  }

  // Extract final text response
  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  // Save assistant message
  const assistantMessage = await createMessage({
    userId,
    teamId,
    role: 'assistant',
    content: textContent,
    toolCalls: toolCallsData,
    richCard: richCard,
  });

  return assistantMessage;
}
