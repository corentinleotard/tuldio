/**
 * Structural guards for the system prompt and tool registry.
 *
 * These are FREE tests (no API calls). They run with `pnpm test`.
 * They prevent the prompt from drifting back to the broken state.
 */

import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../system-prompt.js';
import { chatTools } from '../tool-registry.js';

const prompt = buildSystemPrompt({ teamName: 'Test SARL', userName: 'Jean', demandState: { client: null, document: null } });

describe('system prompt structure', () => {
  it('stays under 60 lines (without demand state)', () => {
    const lineCount = prompt.split('\n').length;
    expect(lineCount).toBeLessThan(60);
  });

  it('never contains UUIDs', () => {
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    expect(prompt).not.toMatch(uuidPattern);
  });

  it('does not script conversation flows (no step-by-step dialogue instructions)', () => {
    // These patterns indicate procedural dialogue scripting — the old broken pattern
    // Tool flow sequences (1. resolve_client 2. prepare_document) are allowed
    const proceduralPatterns = [
      /étape \d/i,
      /step \d/i,
      /selon le résultat/i,
      /si.*retourne.*alors/i,
    ];
    for (const pattern of proceduralPatterns) {
      expect(prompt).not.toMatch(pattern);
    }
  });

  it('contains core identity elements', () => {
    expect(prompt).toContain('assistant');
    expect(prompt).toContain('Jean');
    expect(prompt).toContain('Test SARL');
  });

  it('contains safety rails', () => {
    expect(prompt.toLowerCase()).toContain('never fabricate');
    expect(prompt.toLowerCase()).toContain('never expose');
  });
});

describe('tool descriptions', () => {
  it('every ID parameter includes "current conversation" constraint', () => {
    for (const tool of chatTools) {
      const schema = tool.input_schema as { properties?: Record<string, { description?: string }> };
      if (!schema.properties) continue;

      for (const [paramName, paramSchema] of Object.entries(schema.properties)) {
        if (paramName.endsWith('Id') && paramSchema.description) {
          expect(
            paramSchema.description.toLowerCase(),
            `${tool.name}.${paramName} must include "current conversation" constraint`,
          ).toContain('current conversation');
        }
      }
    }
  });

  it('generate tools reference init_document and add_lines prerequisites', () => {
    const quoteDesc = chatTools.find((t) => t.name === 'generate_quote')!.description;
    const invoiceDesc = chatTools.find((t) => t.name === 'generate_invoice')!.description;
    expect(quoteDesc).toContain('init_document');
    expect(quoteDesc).toContain('add_lines');
    expect(invoiceDesc).toContain('init_document');
    expect(invoiceDesc).toContain('add_lines');
  });

  it('no tool description duplicates system prompt content', () => {
    // Tool descriptions should not repeat the prompt's identity/tone rules
    for (const tool of chatTools) {
      expect(tool.description).not.toMatch(/tutoie/i);
      expect(tool.description).not.toMatch(/toujours en fran[cç]ais/i);
      expect(tool.description).not.toMatch(/amical/i);
    }
  });
});
