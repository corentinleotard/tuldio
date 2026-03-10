/**
 * Eval harness for AI chat behavior tests.
 *
 * These tests call the real Claude API (Haiku) to verify that the AI
 * calls the right tools with the right arguments given specific scenarios.
 *
 * Run with: pnpm eval
 * These are NOT unit tests — they hit the API and cost money (~$0.001/test).
 * They should run on-demand before releasing prompt/context changes, not in CI.
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '../system-prompt.js';
import { chatTools } from '../tool-registry.js';
import type { StoredToolRounds } from '../build-context.js';
import type { Message, DemandState } from '@tuldio/types';
import { buildClaudeMessages, buildContextMessages } from '../build-context.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

export interface EvalScenario {
  name: string;
  /** Messages already in the conversation (simulates stored DB messages) */
  history?: Message[];
  /** The new user message being sent */
  userMessage: string;
  /** Current demand state (simulates persisted state) */
  demandState?: DemandState;
  /** Assertions on the first tool call Claude makes */
  expectToolCall: {
    name: string;
    /** Partial match on the tool input — every key/value must match */
    inputContains?: Record<string, unknown>;
    /** Keys that must NOT appear or must differ */
    inputNotContains?: Record<string, unknown>;
  };
}

function makeMessage(overrides: Partial<Message> & { role: 'user' | 'assistant'; content: string }): Message {
  return {
    id: crypto.randomUUID(),
    userId: 'eval-user',
    attachments: [],
    toolCalls: null,
    richCard: null,
    quickReplies: null,
    debugTrace: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function userMsg(content: string): Message {
  return makeMessage({ role: 'user', content });
}

export function assistantMsg(content: string, toolRounds?: StoredToolRounds): Message {
  return makeMessage({ role: 'assistant', content, toolCalls: toolRounds ?? null });
}

export async function runEval(scenario: EvalScenario): Promise<{
  pass: boolean;
  toolCalls: Array<{ name: string; input: Record<string, unknown> }>;
  error?: string;
}> {
  const allMessages: Message[] = [
    ...(scenario.history ?? []),
    makeMessage({ role: 'user', content: scenario.userMessage }),
  ];

  const demandState = scenario.demandState ?? { client: null, document: null };
  const systemPrompt = buildSystemPrompt({ teamName: 'Eval SARL', userName: 'Jean' });
  const contextMessages = buildContextMessages({ demandState, clientNotFound: null });
  const messages = [...contextMessages, ...buildClaudeMessages(allMessages)];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools: chatTools,
  });

  const toolUseBlocks = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );

  const toolCalls = toolUseBlocks.map((b) => ({
    name: b.name,
    input: b.input as Record<string, unknown>,
  }));

  // Check expectations
  const { expectToolCall } = scenario;

  if (toolCalls.length === 0) {
    return { pass: false, toolCalls, error: `Expected tool call "${expectToolCall.name}" but no tools were called` };
  }

  const firstCall = toolCalls[0]!;

  if (firstCall.name !== expectToolCall.name) {
    return { pass: false, toolCalls, error: `Expected tool "${expectToolCall.name}" but got "${firstCall.name}"` };
  }

  if (expectToolCall.inputContains) {
    for (const [key, value] of Object.entries(expectToolCall.inputContains)) {
      const actual = firstCall.input[key];
      if (typeof value === 'string' && typeof actual === 'string') {
        if (!actual.toLowerCase().includes(value.toLowerCase())) {
          return { pass: false, toolCalls, error: `Expected input.${key} to contain "${value}" but got "${actual}"` };
        }
      } else if (actual !== value) {
        return { pass: false, toolCalls, error: `Expected input.${key} to be ${JSON.stringify(value)} but got ${JSON.stringify(actual)}` };
      }
    }
  }

  if (expectToolCall.inputNotContains) {
    for (const [key, value] of Object.entries(expectToolCall.inputNotContains)) {
      const actual = firstCall.input[key];
      if (actual === value) {
        return { pass: false, toolCalls, error: `Expected input.${key} to NOT be ${JSON.stringify(value)} but it was` };
      }
    }
  }

  return { pass: true, toolCalls };
}
