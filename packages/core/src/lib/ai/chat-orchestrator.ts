import type Anthropic from '@anthropic-ai/sdk';
import type { DemandState } from '@tuldio/types';
import { callClaude } from './claude-client.js';
import { buildSystemPrompt } from './system-prompt.js';
import { buildClaudeMessages, type StoredToolCall } from './build-context.js';
import { chatTools, executeTool, type StateUpdate } from './tool-registry.js';
import { createMessage, listMessages } from '../../modules/messages/index.js';
import { getCurrentUser } from '../../modules/users/index.js';
import { getTeam } from '../../modules/teams/index.js';
import { getDemandState, upsertDemandState, clearDemandState } from '../../modules/demands/index.js';
import { findClientById } from '../../modules/clients/repository/find-client-by-id.js';
import { logger } from '../infra/logger.js';
import type { Message, MessageMetadata, DebugTrace, DebugTraceRound, DebugTraceToolCall } from '@tuldio/types';

const MAX_TOOL_ROUNDS = 10;

function applyStateUpdate(current: DemandState, update: StateUpdate): DemandState | null {
  if (update === null) return null; // no change
  if (update === 'clear') return { client: null, document: null };

  return {
    client: update.client !== undefined ? update.client : current.client,
    document: update.document !== undefined ? update.document : current.document,
  };
}

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
  const [user, team, recentMessages, demandState] = await Promise.all([
    getCurrentUser(userId),
    getTeam(teamId),
    listMessages({ userId, limit: 50 }),
    getDemandState({ userId }),
  ]);

  // Handle client picker selection — set active client from metadata
  let currentState = demandState;
  if (metadata?.selectedClientId) {
    const client = await findClientById({ teamId, clientId: metadata.selectedClientId });
    const clientName = client ? `${client.first_name} ${client.last_name}` : '';
    currentState = { ...currentState, client: { id: metadata.selectedClientId, name: clientName }, document: null };
    await upsertDemandState({ userId, teamId, state: currentState });
  }

  const systemPrompt = buildSystemPrompt({
    teamName: team.name,
    userName: user.name,
    demandState: currentState,
  });

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
  let quickReplies: string[] | null = null;
  const toolRounds: StoredToolCall[][] = [];
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
    const roundStored: StoredToolCall[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolStart = Date.now();
      try {
        const { toolResult: result, stateUpdate } = await executeTool({
          toolName: toolUse.name,
          toolInput: toolUse.input as Record<string, unknown>,
          teamId,
          userId,
          demandState: currentState,
        });

        // Apply state update
        if (stateUpdate !== null) {
          const newState = applyStateUpdate(currentState, stateUpdate);
          if (newState) {
            currentState = newState;
            if (newState.client === null && newState.document === null) {
              await clearDemandState({ userId });
            } else {
              await upsertDemandState({ userId, teamId, state: currentState });
            }
          }
        }

        if (result.richCard) {
          richCard = result.richCard;
        }
        if (result.quickReplies) {
          quickReplies = result.quickReplies;
        }

        roundToolCalls.push({
          name: toolUse.name,
          input: toolUse.input,
          output: result.result,
          durationMs: Date.now() - toolStart,
        });

        roundStored.push({
          toolUseId: toolUse.id,
          name: toolUse.name,
          input: toolUse.input,
          result: result.result,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result.result),
        });
      } catch (err) {
        const isHandled = err instanceof Error && err.name === 'HandledError';
        const code = isHandled ? (err as unknown as { code: string }).code : undefined;
        logger.error(`Tool execution failed: ${toolUse.name}`, {
          error: err,
          input: toolUse.input,
          ...(code ? { code } : {}),
        });
        const errorPayload = code
          ? { error: code, message: (err as Error).message }
          : { error: err instanceof Error ? err.message : 'Erreur interne' };

        roundToolCalls.push({
          name: toolUse.name,
          input: toolUse.input,
          output: errorPayload,
          durationMs: Date.now() - toolStart,
        });

        roundStored.push({
          toolUseId: toolUse.id,
          name: toolUse.name,
          input: toolUse.input,
          result: errorPayload,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(errorPayload),
          is_error: true,
        });
      }
    }

    // Record this round
    traceRounds.push({
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      costCents: meta.costCents,
      durationMs: meta.durationMs,
      toolCalls: roundToolCalls,
    });
    toolRounds.push(roundStored);

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
    toolCalls: toolRounds.length > 0 ? toolRounds : null,
    richCard: richCard,
    quickReplies: quickReplies ?? undefined,
    debugTrace,
  });

  return assistantMessage;
}
