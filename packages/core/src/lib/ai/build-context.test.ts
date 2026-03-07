import { describe, it, expect } from 'vitest';
import { buildClaudeMessages, type StoredToolRounds } from './build-context.js';
import type { Message } from '@tuldio/types';

function makeMessage(overrides: Partial<Message> & { role: 'user' | 'assistant' }): Message {
  return {
    id: 'msg-1',
    userId: 'user-1',
    content: 'test',
    attachments: [],
    toolCalls: null,
    richCard: null,
    quickReplies: null,
    debugTrace: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildClaudeMessages', () => {
  it('returns all messages when <= 4', () => {
    const messages = Array.from({ length: 3 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, role: i % 2 === 0 ? 'user' : 'assistant', content: `msg ${i}` }),
    );

    const result = buildClaudeMessages(messages);
    expect(result).toHaveLength(3);
    expect(result[0]!.content).toBe('msg 0');
  });

  it('returns only last 8 when more than 8', () => {
    const messages = Array.from({ length: 14 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, role: i % 2 === 0 ? 'user' : 'assistant', content: `msg ${i}` }),
    );

    const result = buildClaudeMessages(messages);
    // Last 8 stored messages, all plain text
    expect(result).toHaveLength(8);
    expect(result[0]!.content).toBe('msg 6');
    expect(result[7]!.content).toBe('msg 13');
  });

  it('reconstructs tool_use and tool_result blocks from stored tool rounds', () => {
    const toolRounds: StoredToolRounds = [
      [
        {
          toolUseId: 'tu-1',
          name: 'resolve_client',
          input: { search: 'Martin' },
          result: { status: 'exact_match', client: { id: 'abc-123', name: 'Martin Jean' } },
        },
      ],
    ];

    const messages = [
      makeMessage({ id: 'msg-0', role: 'user', content: 'Devis pour Martin' }),
      makeMessage({
        id: 'msg-1',
        role: 'assistant',
        content: 'Je pars sur Martin Jean ?',
        toolCalls: toolRounds as unknown as Message['toolCalls'],
      }),
    ];

    const result = buildClaudeMessages(messages);

    // user message + assistant tool_use + user tool_result + assistant text = 4 API messages
    expect(result).toHaveLength(4);
    expect(result[0]!.role).toBe('user');
    expect(result[0]!.content).toBe('Devis pour Martin');

    // Assistant with tool_use block
    expect(result[1]!.role).toBe('assistant');
    const assistantContent = result[1]!.content as Array<{ type: string; name?: string }>;
    expect(assistantContent[0]!.type).toBe('tool_use');
    expect(assistantContent[0]!.name).toBe('resolve_client');

    // User with tool_result block
    expect(result[2]!.role).toBe('user');
    const toolResultContent = result[2]!.content as Array<{ type: string; tool_use_id?: string }>;
    expect(toolResultContent[0]!.type).toBe('tool_result');
    expect(toolResultContent[0]!.tool_use_id).toBe('tu-1');

    // Final assistant text
    expect(result[3]!.role).toBe('assistant');
    expect(result[3]!.content).toBe('Je pars sur Martin Jean ?');
  });

  it('handles multi-round tool calls', () => {
    const toolRounds: StoredToolRounds = [
      [{ toolUseId: 'tu-1', name: 'resolve_client', input: { search: 'Martin' }, result: { id: 'abc' } }],
      [{ toolUseId: 'tu-2', name: 'generate_quote', input: { clientId: 'abc' }, result: { quoteId: 'q-1' } }],
    ];

    const messages = [
      makeMessage({ id: 'msg-0', role: 'user', content: 'Devis Martin carrelage 10m2 45e' }),
      makeMessage({
        id: 'msg-1',
        role: 'assistant',
        content: 'Voila ton devis !',
        toolCalls: toolRounds as unknown as Message['toolCalls'],
      }),
    ];

    const result = buildClaudeMessages(messages);

    // user + (tool_use + tool_result) * 2 rounds + final text = 6 API messages
    expect(result).toHaveLength(6);
    expect(result[0]!.role).toBe('user');
    expect(result[1]!.role).toBe('assistant'); // tool_use round 1
    expect(result[2]!.role).toBe('user');      // tool_result round 1
    expect(result[3]!.role).toBe('assistant'); // tool_use round 2
    expect(result[4]!.role).toBe('user');      // tool_result round 2
    expect(result[5]!.role).toBe('assistant'); // final text
    expect(result[5]!.content).toBe('Voila ton devis !');
  });

  it('ensures first message is from user role', () => {
    const messages = [
      makeMessage({ id: 'msg-0', role: 'assistant', content: 'Bonjour !' }),
      makeMessage({ id: 'msg-1', role: 'user', content: 'Salut' }),
      makeMessage({ id: 'msg-2', role: 'assistant', content: 'Comment je peux aider ?' }),
    ];

    const result = buildClaudeMessages(messages);
    expect(result[0]!.role).toBe('user');
  });

  it('walks back to include preceding user message when slice starts with assistant', () => {
    const toolRounds: StoredToolRounds = [
      [{ toolUseId: 'tu-1', name: 'search_clients', input: { search: 'Marion' }, result: { id: 'c-1' } }],
    ];

    // 6 stored messages — naive slice of last 4 would start at msg-2 (assistant with tools).
    // Instead, it walks back to msg-1's preceding user message (msg-0) to keep context valid.
    const messages = [
      makeMessage({ id: 'msg-0', role: 'user', content: 'Salut' }),
      makeMessage({ id: 'msg-1', role: 'assistant', content: 'Bonjour !' }),
      makeMessage({
        id: 'msg-2',
        role: 'assistant',
        content: 'Marion trouvée.',
        toolCalls: toolRounds as unknown as Message['toolCalls'],
      }),
      makeMessage({ id: 'msg-3', role: 'user', content: '30m terrassement' }),
      makeMessage({ id: 'msg-4', role: 'assistant', content: 'Confirme les prix.' }),
      makeMessage({ id: 'msg-5', role: 'user', content: 'combien le dernier terrassement' }),
    ];

    const result = buildClaudeMessages(messages);

    // Starts with user message (msg-0), includes all 6 stored messages expanded
    expect(result[0]!.role).toBe('user');
    expect(result[0]!.content).toBe('Salut');

    // tool_use and tool_result are properly paired (not orphaned)
    const toolUseMsg = result.find(
      (m) => Array.isArray(m.content) && m.content.some((b) => 'type' in b && b.type === 'tool_use'),
    );
    const toolResultMsg = result.find(
      (m) => Array.isArray(m.content) && m.content.some((b) => 'type' in b && b.type === 'tool_result'),
    );
    expect(toolUseMsg).toBeDefined();
    expect(toolResultMsg).toBeDefined();
  });

  it('falls back to plain text for assistant messages without tool rounds', () => {
    const messages = [
      makeMessage({ id: 'msg-0', role: 'user', content: 'Salut' }),
      makeMessage({ id: 'msg-1', role: 'assistant', content: 'Bonjour !' }),
    ];

    const result = buildClaudeMessages(messages);
    expect(result).toHaveLength(2);
    expect(result[1]!.content).toBe('Bonjour !');
  });
});
