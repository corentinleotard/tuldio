import type Anthropic from '@anthropic-ai/sdk';
import { callClaude } from './claude-client.js';
import { buildSystemPrompt } from './system-prompt.js';
import { buildClaudeMessages, buildContextSummary } from './build-context.js';
import { chatTools, executeTool } from './tool-registry.js';
import { createMessage, listMessages } from '../../modules/messages/index.js';
import { getCurrentUser } from '../../modules/users/index.js';
import { getTeam } from '../../modules/teams/index.js';
import { logger } from '../infra/logger.js';
import type { Message, MessageMetadata, DebugTrace, DebugTraceRound, DebugTraceToolCall } from '@tuldio/types';

const MAX_TOOL_ROUNDS = 10;

export async function processMessage(input: {
  userId: string;
  teamId: string;
  content: string;
  metadata?: MessageMetadata;
}): Promise<Message> {
  const { userId, teamId, content, metadata } = input;

  // Save user message
  await createMessage({ userId, teamId, role: 'user', content });

  // Load context
  const [user, team, recentMessages] = await Promise.all([
    getCurrentUser(userId),
    getTeam(teamId),
    listMessages({ userId, limit: 50 }),
  ]);

  const contextSummary = buildContextSummary(recentMessages);
  const metadataContext = metadata?.selectedClientId
    ? `\n\nL'utilisateur vient de sélectionner un client via la carte interactive. Le clientId sélectionné est: ${metadata.selectedClientId}. Utilise ce clientId directement, pas besoin de resolve_client.`
    : '';
  const systemPrompt = buildSystemPrompt({
    teamName: team.name,
    userName: user.name,
  }) + (contextSummary ? `\n\n${contextSummary}` : '') + metadataContext;

  const claudeMessages: Anthropic.MessageParam[] = buildClaudeMessages(recentMessages);

  // Call Claude with tools
  let { message: response, meta } = await callClaude({
    systemPrompt,
    messages: claudeMessages,
    tools: chatTools,
    teamId,
    userId,
    purpose: 'chat',
  });

  let richCard: { type: string; data: unknown } | null = null;
  const allToolCalls: { name: string; input: unknown }[] = [];
  const traceRounds: DebugTraceRound[] = [];

  // Handle tool use loop
  let rounds = 0;
  while (response.stop_reason === 'tool_use' && rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    const roundToolCalls: DebugTraceToolCall[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolStart = Date.now();
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

        roundToolCalls.push({
          name: toolUse.name,
          input: toolUse.input,
          output: result.result,
          durationMs: Date.now() - toolStart,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result.result),
        });
      } catch (err) {
        logger.error(`Tool execution failed: ${toolUse.name}`, { error: err });
        const errorPayload = { error: err instanceof Error ? err.message : 'Erreur interne' };

        roundToolCalls.push({
          name: toolUse.name,
          input: toolUse.input,
          output: errorPayload,
          durationMs: Date.now() - toolStart,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(errorPayload),
          is_error: true,
        });
      }
    }

    // Record this round in the trace
    traceRounds.push({
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      costCents: meta.costCents,
      durationMs: meta.durationMs,
      toolCalls: roundToolCalls,
    });

    // Accumulate all tool calls across loop iterations
    for (const b of toolUseBlocks) {
      allToolCalls.push({ name: b.name, input: b.input });
    }

    // Continue conversation with tool results
    claudeMessages.push({ role: 'assistant', content: response.content });
    claudeMessages.push({ role: 'user', content: toolResults });

    ({ message: response, meta } = await callClaude({
      systemPrompt,
      messages: claudeMessages,
      tools: chatTools,
      teamId,
      userId,
      purpose: 'chat',
    }));
  }

  if (rounds >= MAX_TOOL_ROUNDS && response.stop_reason === 'tool_use') {
    logger.warn('Tool loop hit max rounds', { userId, teamId, rounds });
  }

  // Record the final round (the one that produced text)
  traceRounds.push({
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    costCents: meta.costCents,
    durationMs: meta.durationMs,
    toolCalls: [],
  });

  // Build debug trace
  const debugTrace: DebugTrace = {
    rounds: traceRounds,
    totalTokens: traceRounds.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    totalCostCents: traceRounds.reduce((s, r) => s + r.costCents, 0),
    totalDurationMs: traceRounds.reduce((s, r) => s + r.durationMs, 0),
  };

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
    toolCalls: allToolCalls.length > 0 ? allToolCalls : null,
    richCard: richCard,
    debugTrace,
  });

  return assistantMessage;
}
