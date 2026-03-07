/**
 * Structural guards for the system prompt and tool registry.
 *
 * These are FREE tests (no API calls). They run with `pnpm test`.
 * They prevent the prompt from drifting back to the broken state.
 */

import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../system-prompt.js';
import { chatTools } from '../tool-registry.js';

const prompt = buildSystemPrompt({ teamName: 'Test SARL', userName: 'Jean' });

describe('system prompt structure', () => {
  it('stays under 50 lines', () => {
    const lineCount = prompt.split('\n').length;
    expect(lineCount).toBeLessThan(50);
  });

  it('never mentions tool names', () => {
    const toolNames = chatTools.map((t) => t.name);
    for (const name of toolNames) {
      expect(prompt).not.toContain(name);
    }
  });

  it('never contains UUIDs', () => {
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    expect(prompt).not.toMatch(uuidPattern);
  });

  it('does not script conversation flows (no step-by-step instructions)', () => {
    // These patterns indicate procedural scripting — the old broken pattern
    const proceduralPatterns = [
      /étape \d/i,
      /step \d/i,
      /1\.\s.*\n2\.\s.*\n3\.\s/,  // numbered multi-step sequences
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

  it('quote and invoice tools reference search_past_pricing', () => {
    const quoteDesc = chatTools.find((t) => t.name === 'generate_quote')!.description;
    const invoiceDesc = chatTools.find((t) => t.name === 'generate_invoice')!.description;
    expect(quoteDesc).toContain('search_past_pricing');
    expect(invoiceDesc).toContain('search_past_pricing');
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
