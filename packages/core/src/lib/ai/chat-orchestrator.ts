import type Anthropic from '@anthropic-ai/sdk';
import type { ActiveState } from '@tuldio/types';
import { callClaude } from './claude-client.js';
import { buildSystemPrompt } from './system-prompt.js';
import { buildClaudeMessages, buildContextMessages, extractStoredToolCalls, type StoredToolCall } from './build-context.js';
import { chatTools, executeTool } from './tool-registry.js';
import { buildRefMap, registerRef, resolveRef, findRefByEntityId } from './ref-map.js';
import { createMessage, listMessages } from '../../modules/messages/index.js';
import { getCurrentUser } from '../../modules/users/index.js';
import { getTeam } from '../../modules/teams/index.js';
import { getDemandState, upsertDemandState, clearDemandState } from '../../modules/demands/index.js';
import { findClientById } from '../../modules/clients/repository/find-client-by-id.js';
import { getClientDisplayName } from '../../modules/clients/domain/get-client-display-name.js';
import { getQuote } from '../../modules/quotes/index.js';
import { getInvoice } from '../../modules/invoices/index.js';
import { HandledError } from '../errors/handled-error.js';
import { errorCodes } from '../errors/error-codes.js';
import { logger } from '../infra/logger.js';
import type { Message, MessageMetadata, DebugTrace, DebugTraceRound, DebugTraceToolCall } from '@tuldio/types';

const MAX_TOOL_ROUNDS = 10;

// In-memory lock to prevent concurrent message processing for the same user.
// Protects demand_state from race conditions (last-write-wins).
// If scaling to multi-process, replace with a DB advisory lock.
const processingUsers = new Set<string>();

async function fetchDocumentNumber(input: { teamId: string; docId: string; docType: 'quote' | 'invoice' }): Promise<string> {
  if (input.docType === 'quote') {
    const quote = await getQuote({ teamId: input.teamId, quoteId: input.docId });
    return quote.number;
  }
  const invoice = await getInvoice({ teamId: input.teamId, invoiceId: input.docId });
  return invoice.number;
}

/** Convert ActiveState to the DemandState shape used by the DB layer */
function toDbState(activeState: ActiveState): { client: { id: string; name: string } | null; document: { id: string; type: 'quote' | 'invoice'; number: string } | null } {
  return {
    client: activeState.client,
    document: activeState.document ? { id: activeState.document.id, type: activeState.document.type, number: activeState.document.number } : null,
  };
}

function applyActiveStateUpdate(current: ActiveState, update: Partial<ActiveState>): ActiveState {
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

  // Prevent concurrent processing for the same user
  if (processingUsers.has(userId)) {
    throw new HandledError(errorCodes.messageAlreadyProcessing);
  }
  processingUsers.add(userId);

  try {
  // 1. Save user message
  await createMessage({ userId, teamId, role: 'user', content });

  // 2. Load context
  const [user, team, recentMessages, demandState] = await Promise.all([
    getCurrentUser(userId),
    getTeam(teamId),
    // Fetch more than the 8-message window — the windowing logic may back up
    // to find a user message boundary, so we need headroom.
    listMessages({ userId, limit: 20 }),
    getDemandState({ userId }),
  ]);

  // 3. Build active state from demand state
  let activeState: ActiveState = {
    client: demandState.client,
    document: null,
  };
  if (demandState.document?.id) {
    // Use persisted number if available, otherwise fetch from DB
    const number = demandState.document.number;
    if (number) {
      activeState.document = { id: demandState.document.id, type: demandState.document.type, number };
    } else {
      try {
        const docNumber = await fetchDocumentNumber({ teamId, docId: demandState.document.id, docType: demandState.document.type });
        activeState.document = { id: demandState.document.id, type: demandState.document.type, number: docNumber };
      } catch {
        // Document no longer exists — clear stale reference
        activeState.document = null;
      }
    }
  }

  // Guard against old-format demand state (document without id)
  if (activeState.document && !activeState.document.id) {
    activeState = { ...activeState, document: null };
    await clearDemandState({ userId });
  }

  // 5. Handle client picker selection
  if (metadata?.selectedClientId) {
    const client = await findClientById({ teamId, clientId: metadata.selectedClientId });
    if (client) {
      const clientName = getClientDisplayName(client);
      activeState = { client: { id: metadata.selectedClientId, name: clientName }, document: null };
      await upsertDemandState({ userId, teamId, state: toDbState(activeState) });
    }
  }

  // 4. Build ref map from active state + recent messages' stored tool calls
  const storedToolCalls = extractStoredToolCalls(recentMessages);
  const { refMap, counters } = buildRefMap({
    activeState,
    recentToolCalls: storedToolCalls,
  });

  // 6. Build system prompt (static, cacheable)
  const systemPrompt = buildSystemPrompt({ teamName: team.name, userName: user.name });

  // 7. Build Claude messages from recent messages + active state context
  const claudeMessages: Anthropic.MessageParam[] = buildClaudeMessages(recentMessages);
  const getActiveRefs = () => ({
    clientRef: activeState.client ? findRefByEntityId(refMap, 'client', activeState.client.id) : null,
    documentRef: activeState.document ? findRefByEntityId(refMap, activeState.document.type, activeState.document.id) : null,
  });
  let contextMessages = buildContextMessages({ activeState, ...getActiveRefs() });

  // 8. Call Claude — NO pre-processing step
  let { message: response, meta } = await callClaude({
    systemPrompt,
    messages: claudeMessages,
    contextMessages,
    tools: chatTools,
    teamId,
    userId,
    purpose: 'chat',
  });

  const traceRounds: DebugTraceRound[] = [];
  const toolRounds: StoredToolCall[][] = [];
  let richCard: { type: string; data: unknown } | null = null;
  let quickReplies: string[] | null = null;
  let stateChanged = false;

  // 9. Tool use loop
  //
  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║ DO NOT REMOVE — ONE TOOL PER ROUND — CRITICAL FOR DATA INTEGRITY  ║
  // ╠══════════════════════════════════════════════════════════════════════╣
  // ║                                                                    ║
  // ║ We execute exactly ONE tool per round, even when Claude returns    ║
  // ║ multiple tool_use blocks in a single response.                     ║
  // ║                                                                    ║
  // ║ WHY: Claude generates ALL tool inputs based on the state at the    ║
  // ║ START of its response. When tool A changes state (e.g.             ║
  // ║ create_client sets a new active client), tool B's inputs are       ║
  // ║ already locked to the OLD state. This causes data corruption:     ║
  // ║                                                                    ║
  // ║   Example: "devis pour Jean Renaud"                                ║
  // ║   - Active client: c0 = Laurence Martin                           ║
  // ║   - Claude calls: create_client(Jean) + create_document(c0)       ║
  // ║   - create_client registers c1 = Jean Renaud, updates state       ║
  // ║   - create_document uses c0 → quote created for WRONG CLIENT      ║
  // ║                                                                    ║
  // ║ By executing one tool per round, we rebuild context (line ~249)    ║
  // ║ after each tool. Claude then sees the updated state and uses the   ║
  // ║ correct refs for the next tool call.                               ║
  // ║                                                                    ║
  // ║ Cost: ~0.7s latency + ~0.3¢ per extra round. Only affects         ║
  // ║ messages where Claude batches multiple tools (rare).               ║
  // ║                                                                    ║
  // ║ This is the industry standard for agentic loops with mutable       ║
  // ║ state. DO NOT optimize back to parallel execution.                 ║
  // ╚══════════════════════════════════════════════════════════════════════╝
  //
  let rounds = 0;
  while (response.stop_reason === 'tool_use' && rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    // Execute only the FIRST tool — discard the rest.
    // Claude will re-evaluate and re-call remaining tools with updated context.
    const toolUse = toolUseBlocks[0]!;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    const roundToolCalls: DebugTraceToolCall[] = [];
    const roundStored: StoredToolCall[] = [];

    const toolStart = Date.now();
    try {
      const { toolResult: result, refs } = await executeTool({
        toolName: toolUse.name,
        toolInput: toolUse.input as Record<string, unknown>,
        refMap,
        ctx: {
          teamId,
          userId,
          resolveRef: (ref, expectedType) => resolveRef({ refMap, ref, expectedType }),
          registerRef: (type, id) => registerRef({ refMap, type, id, counters }),
          activeDocumentId: activeState.document?.id ?? null,
        },
      });

      // Apply active state update
      if (result.activeStateUpdate) {
        activeState = applyActiveStateUpdate(activeState, result.activeStateUpdate);
        stateChanged = true;
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
        refs,
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

    // Record this round
    traceRounds.push({
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      costCents: meta.costCents,
      durationMs: meta.durationMs,
      toolCalls: roundToolCalls,
    });
    toolRounds.push(roundStored);

    // Continue conversation with tool results.
    // Only include the executed tool_use block — strip discarded ones so Claude
    // doesn't see stale tool calls in its conversation history.
    const executedContent = response.content.filter(
      (block) => block.type !== 'tool_use' || block.id === toolUse.id,
    );
    claudeMessages.push({ role: 'assistant', content: executedContent });
    claudeMessages.push({ role: 'user', content: toolResults });

    // Rebuild context messages with updated state
    contextMessages = buildContextMessages({ activeState, ...getActiveRefs() });

    ({ message: response, meta } = await callClaude({
      systemPrompt,
      messages: claudeMessages,
      contextMessages,
      tools: chatTools,
      teamId,
      userId,
      purpose: 'chat',
    }));

    // Fix #5: If a client_picker card was returned, stop the loop.
    // The user must interact (pick a client) before the AI continues.
    if (richCard?.type === 'client_picker') break;
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

  // 10. Persist active state if changed
  if (stateChanged) {
    const dbState = toDbState(activeState);
    if (dbState.client === null && dbState.document === null) {
      await clearDemandState({ userId });
    } else {
      await upsertDemandState({ userId, teamId, state: dbState });
    }
  }

  // Build debug trace
  const debugTrace: DebugTrace = {
    rounds: traceRounds,
    totalTokens: traceRounds.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    totalCostCents: traceRounds.reduce((s, r) => s + r.costCents, 0),
    totalDurationMs: traceRounds.reduce((s, r) => s + r.durationMs, 0),
  };

  // 11. Extract final text response
  // Fix #3: If the loop ended early (MAX_TOOL_ROUNDS or client_picker break),
  // the response may contain tool_use blocks with no text. Extract whatever
  // text exists; fallback to empty string (the rich card carries the content).
  const textContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  // 12. Save assistant message
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

  } finally {
    processingUsers.delete(userId);
  }
}
