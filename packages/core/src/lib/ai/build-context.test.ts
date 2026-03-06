import { describe, it, expect } from 'vitest';
import { buildContextSummary, buildClaudeMessages } from './build-context.js';
import type { Message } from '@tuldio/types';

function makeMessage(overrides: Partial<Message> & { role: 'user' | 'assistant' }): Message {
  return {
    id: 'msg-1',
    userId: 'user-1',
    content: 'test',
    attachments: [],
    toolCalls: null,
    richCard: null,
    debugTrace: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildClaudeMessages', () => {
  it('returns all messages when <= 8', () => {
    const messages = Array.from({ length: 5 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, role: i % 2 === 0 ? 'user' : 'assistant', content: `msg ${i}` }),
    );

    const result = buildClaudeMessages(messages);
    expect(result).toHaveLength(5);
    expect(result[0]!.content).toBe('msg 0');
  });

  it('returns only last 8 when more than 8', () => {
    const messages = Array.from({ length: 20 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, role: i % 2 === 0 ? 'user' : 'assistant', content: `msg ${i}` }),
    );

    const result = buildClaudeMessages(messages);
    expect(result).toHaveLength(8);
    expect(result[0]!.content).toBe('msg 12');
    expect(result[7]!.content).toBe('msg 19');
  });
});

describe('buildContextSummary', () => {
  it('returns null when <= 8 messages', () => {
    const messages = Array.from({ length: 6 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, role: i % 2 === 0 ? 'user' : 'assistant' }),
    );

    expect(buildContextSummary(messages)).toBeNull();
  });

  it('returns null when older messages have no tool calls', () => {
    const messages = Array.from({ length: 12 }, (_, i) =>
      makeMessage({ id: `msg-${i}`, role: i % 2 === 0 ? 'user' : 'assistant' }),
    );

    expect(buildContextSummary(messages)).toBeNull();
  });

  it('summarizes tool calls from older messages', () => {
    const messages = Array.from({ length: 12 }, (_, i) =>
      makeMessage({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        toolCalls: i === 1 ? [{ name: 'resolve_client', input: { search: 'Martin' } }] : null,
      }),
    );

    const result = buildContextSummary(messages);
    expect(result).toContain('Recherche client "Martin"');
    expect(result).toContain('Actions précédentes');
  });

  it('caps at 20 actions', () => {
    const toolCalls = Array.from({ length: 30 }, (_, i) => ({
      name: 'resolve_client',
      input: { search: `Client ${i}` },
    }));

    const messages = [
      makeMessage({ id: 'msg-0', role: 'assistant', toolCalls }),
      ...Array.from({ length: 10 }, (_, i) =>
        makeMessage({ id: `msg-${i + 1}`, role: i % 2 === 0 ? 'user' : 'assistant' }),
      ),
    ];

    const result = buildContextSummary(messages)!;
    expect(result).toContain('10 actions plus anciennes omises');
    // Should contain last 20, not first
    expect(result).toContain('Client 29');
    expect(result).not.toContain('Client 0');
  });

  it('describes generate_quote with lines', () => {
    const messages = [
      makeMessage({
        id: 'msg-0',
        role: 'assistant',
        toolCalls: [{
          name: 'generate_quote',
          input: {
            clientId: 'abc',
            tvaRate: 20,
            lines: [{ description: 'Carrelage', quantity: 10, unitPrice: 6200 }],
          },
        }],
      }),
      ...Array.from({ length: 8 }, (_, i) =>
        makeMessage({ id: `msg-${i + 1}`, role: i % 2 === 0 ? 'user' : 'assistant' }),
      ),
    ];

    const result = buildContextSummary(messages)!;
    expect(result).toContain('Devis créé');
    expect(result).toContain('Carrelage');
    expect(result).toContain('62,00€');
  });

  it('describes invoice_from_quote', () => {
    const messages = [
      makeMessage({
        id: 'msg-0',
        role: 'assistant',
        toolCalls: [{
          name: 'invoice_from_quote',
          input: { quoteId: 'quote-123' },
        }],
      }),
      ...Array.from({ length: 8 }, (_, i) =>
        makeMessage({ id: `msg-${i + 1}`, role: i % 2 === 0 ? 'user' : 'assistant' }),
      ),
    ];

    const result = buildContextSummary(messages)!;
    expect(result).toContain('Facture créée depuis devis quote-123');
  });
});
