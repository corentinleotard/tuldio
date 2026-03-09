import type Anthropic from '@anthropic-ai/sdk';
import type { DemandState, QuoteView, InvoiceView } from '@tuldio/types';
import { callClaude } from './claude-client.js';
import { buildSystemPrompt, buildDetectionSystemPrompt } from './system-prompt.js';
import { buildClaudeMessages, DETECTION_MESSAGES_COUNT, type StoredToolCall } from './build-context.js';
import { chatTools, detectClientTools, executeTool, type StateUpdate } from './tool-registry.js';
import { createMessage, listMessages } from '../../modules/messages/index.js';
import { getCurrentUser } from '../../modules/users/index.js';
import { getTeam } from '../../modules/teams/index.js';
import { getDemandState, upsertDemandState, clearDemandState } from '../../modules/demands/index.js';
import { findClientById } from '../../modules/clients/repository/find-client-by-id.js';
import { resolveClient } from '../../modules/clients/index.js';
import { getQuote } from '../../modules/quotes/index.js';
import { getInvoice } from '../../modules/invoices/index.js';
import { logger } from '../infra/logger.js';
import type { Message, MessageMetadata, DebugTrace, DebugTraceRound, DebugTraceToolCall } from '@tuldio/types';

const MAX_TOOL_ROUNDS = 10;

function applyStateUpdate(current: DemandState, update: StateUpdate): DemandState | null {
  if (update === null) return null; // no change
  if (update === 'clear') return { client: null, document: null, pendingCandidates: null };

  return {
    client: update.client !== undefined ? update.client : current.client,
    document: update.document !== undefined ? update.document : current.document,
    pendingCandidates: update.pendingCandidates !== undefined ? update.pendingCandidates : current.pendingCandidates,
  };
}

/** Fetch the active document from DB if the state has a document pointer */
async function fetchActiveDocument(input: {
  state: DemandState;
  teamId: string;
}): Promise<(QuoteView | InvoiceView) | null> {
  const docPointer = input.state.document;
  if (!docPointer?.id) return null;

  try {
    if (docPointer.type === 'quote') {
      return await getQuote({ teamId: input.teamId, quoteId: docPointer.id });
    }
    return await getInvoice({ teamId: input.teamId, invoiceId: docPointer.id });
  } catch {
    // Document not found (deleted?) — will be cleared below
    return null;
  }
}

interface DetectClientResult {
  clientMentioned: boolean;
  search?: string;
  clientId?: string;
}

/** Pre-processing step: detect client mentions and resolve in code */
async function preProcessClientDetection(input: {
  currentState: DemandState;
  allMessages: Message[];
  teamId: string;
  userId: string;
}): Promise<{
  currentState: DemandState;
  richCard: { type: string; data: unknown } | null;
  quickReplies: string[] | null;
  traceRound: DebugTraceRound;
}> {
  const { teamId, userId, allMessages } = input;

  // Minimal prompt: only active client + pending candidates
  const systemPrompt = buildDetectionSystemPrompt({ demandState: input.currentState });
  // Short message window: only last 3 messages (enough for anaphoric references)
  const claudeMessages = buildClaudeMessages(allMessages, { limit: DETECTION_MESSAGES_COUNT });
  let { currentState } = input;
  let richCard: { type: string; data: unknown } | null = null;
  let quickReplies: string[] | null = null;

  // Step 1: Force detect_client call
  const detectResponse = await callClaude({
    systemPrompt,
    messages: claudeMessages,
    tools: detectClientTools,
    toolChoice: { type: 'tool', name: 'detect_client' },
    teamId,
    userId,
    purpose: 'detect_client',
  });

  const detectToolUse = detectResponse.message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === 'detect_client',
  );

  const detection = detectToolUse?.input as DetectClientResult | undefined;

  logger.info('detect_client', { teamId, userId, detection });

  // Step 2: Process detection result in code
  if (detection?.clientMentioned) {
    if (detection.clientId) {
      // Direct pick from pending candidates
      const client = await findClientById({ teamId, clientId: detection.clientId });
      if (client) {
        const clientChanged = currentState.client?.id !== client.id;
        currentState = {
          ...currentState,
          client: { id: client.id, name: `${client.first_name} ${client.last_name}` },
          pendingCandidates: null,
          ...(clientChanged ? { document: null } : {}),
        };
      } else {
        // Invalid clientId — clear pending candidates
        currentState = { ...currentState, pendingCandidates: null };
      }
    } else if (detection.search) {
      // Fuzzy search
      const resolution = await resolveClient({ teamId, search: detection.search });
      logger.info('resolve_client', { teamId, userId, search: detection.search, status: resolution.status });

      if (resolution.status === 'exact_match') {
        const clientChanged = currentState.client?.id !== resolution.client.id;
        currentState = {
          ...currentState,
          client: { id: resolution.client.id, name: `${resolution.client.firstName} ${resolution.client.lastName}` },
          pendingCandidates: null,
          ...(clientChanged ? { document: null } : {}),
        };
      } else if (resolution.status === 'ambiguous') {
        const candidates = resolution.candidates.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
        }));
        currentState = { ...currentState, pendingCandidates: candidates };

        if (resolution.candidates.length <= 3) {
          richCard = { type: 'client_picker', data: resolution.candidates };
        }
      } else if (resolution.status === 'no_match') {
        currentState = { ...currentState, pendingCandidates: null };
        quickReplies = ['Oui, crée-le'];
      }
    }
  } else {
    // No client mentioned — clear stale pending candidates
    if (currentState.pendingCandidates && currentState.pendingCandidates.length > 0) {
      currentState = { ...currentState, pendingCandidates: null };
    }
  }

  const traceRound: DebugTraceRound = {
    inputTokens: detectResponse.meta.inputTokens,
    outputTokens: detectResponse.meta.outputTokens,
    costCents: detectResponse.meta.costCents,
    durationMs: detectResponse.meta.durationMs,
    toolCalls: [{
      name: 'detect_client',
      input: detection ?? {},
      output: detection ?? {},
      durationMs: 0,
    }],
  };

  return { currentState, richCard, quickReplies, traceRound };
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

  // Guard against old-format demand state (document without id)
  if (currentState.document && !currentState.document.id) {
    currentState = { ...currentState, document: null };
    await clearDemandState({ userId });
  }

  if (metadata?.selectedClientId) {
    const client = await findClientById({ teamId, clientId: metadata.selectedClientId });
    const clientName = client ? `${client.first_name} ${client.last_name}` : '';
    currentState = { ...currentState, client: { id: metadata.selectedClientId, name: clientName }, document: null, pendingCandidates: null };
    await upsertDemandState({ userId, teamId, state: currentState });
  }

  // Fetch active document from DB
  let activeDocument = await fetchActiveDocument({ state: currentState, teamId });

  // If document pointer exists but document not found, clear it
  if (currentState.document && !activeDocument) {
    currentState = { ...currentState, document: null };
    await upsertDemandState({ userId, teamId, state: currentState });
  }

  let systemPrompt = buildSystemPrompt({
    teamName: team.name,
    userName: user.name,
    demandState: currentState,
    activeDocument,
  });

  const claudeMessages: Anthropic.MessageParam[] = buildClaudeMessages(recentMessages);

  // --- Pre-processing: detect client mentions and resolve in code ---
  const traceRounds: DebugTraceRound[] = [];
  let richCard: { type: string; data: unknown } | null = null;
  let quickReplies: string[] | null = null;

  // Skip detection if client was already selected via picker metadata
  if (!metadata?.selectedClientId) {
    const detection = await preProcessClientDetection({
      currentState,
      allMessages: recentMessages,
      teamId,
      userId,
    });

    currentState = detection.currentState;
    richCard = detection.richCard;
    quickReplies = detection.quickReplies;
    traceRounds.push(detection.traceRound);

    // Persist state if it changed
    await upsertDemandState({ userId, teamId, state: currentState });

    // Re-fetch active document after potential state change
    activeDocument = await fetchActiveDocument({ state: currentState, teamId });

    // Rebuild system prompt with updated state
    systemPrompt = buildSystemPrompt({
      teamName: team.name,
      userName: user.name,
      demandState: currentState,
      activeDocument,
    });
  }

  // --- Main agent call ---
  let { message: response, meta } = await callClaude({
    systemPrompt,
    messages: claudeMessages,
    tools: chatTools,
    teamId,
    userId,
    purpose: 'chat',
  });

  const toolRounds: StoredToolCall[][] = [];

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
            if (newState.client === null && newState.document === null && !newState.pendingCandidates) {
              await clearDemandState({ userId });
            } else {
              await upsertDemandState({ userId, teamId, state: currentState });
            }

            // Re-fetch active document after state change
            activeDocument = await fetchActiveDocument({ state: currentState, teamId });
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

    // Rebuild system prompt so Claude sees updated state
    systemPrompt = buildSystemPrompt({
      teamName: team.name,
      userName: user.name,
      demandState: currentState,
      activeDocument,
    });

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
