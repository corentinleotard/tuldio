/**
 * Eval: Demand state flow — the AI must use init_document/add_lines and respect active state.
 *
 * Tests the full document creation flow:
 * - AI calls init_document + add_lines when user gives line items
 * - AI calls resolve_client when user switches client mid-flow
 * - AI calls generate_quote when demand state is complete
 *
 * Run with: pnpm eval
 */

import { describe, it, expect } from 'vitest';
import { runEval, userMsg, assistantMsg, type EvalScenario } from './eval-harness.js';
import type { StoredToolRounds } from '../build-context.js';
import type { DemandState } from '@tuldio/types';

const TIMEOUT = 30_000;

describe('demand flow evals', () => {
  it('calls search_past_pricing or init_document when user provides line items', async () => {
    // Client already resolved, user gives lines
    // AI may call search_past_pricing first (proactive pricing lookup) or init_document + add_lines
    const resolveRounds: StoredToolRounds = [[{
      toolUseId: 'tu-resolve',
      name: 'resolve_client',
      input: { search: 'Martin' },
      result: { status: 'exact_match', client: { id: 'c1', firstName: 'Jean', lastName: 'Martin' } },
    }]];

    const scenario: EvalScenario = {
      name: 'line items trigger tool action',
      history: [
        userMsg('Fais un devis pour Martin'),
        assistantMsg('J\'ai trouvé Jean Martin. C\'est de la réno ou du neuf ?', resolveRounds),
        userMsg('réno'),
        assistantMsg('C\'est noté réno. Quels travaux ?'),
      ],
      demandState: {
        client: { id: 'c1', name: 'Jean Martin' },
        document: null,
      },
      userMessage: '30 metres lineaires de terrassement et 25m2 de polyane',
      expectToolCall: {
        // AI should either search past pricing or prepare the document — both are valid
        name: 'search_past_pricing',
      },
    };

    const result = await runEval(scenario);
    // Accept search_past_pricing or init_document (first step of cart pattern)
    if (!result.pass) {
      const firstTool = result.toolCalls[0]?.name;
      expect(firstTool, result.error).toBe('init_document');
    }
  }, TIMEOUT);

  it('calls resolve_client when user switches client mid-flow', async () => {
    // Client Martin resolved, lines prepared, user switches to Dupont
    const resolveRounds: StoredToolRounds = [[{
      toolUseId: 'tu-resolve',
      name: 'resolve_client',
      input: { search: 'Martin' },
      result: { status: 'exact_match', client: { id: 'c1', firstName: 'Jean', lastName: 'Martin' } },
    }]];

    const scenario: EvalScenario = {
      name: 'client switch triggers resolve_client',
      history: [
        userMsg('Devis pour Martin, 10m2 carrelage'),
        assistantMsg('J\'ai trouvé Jean Martin et préparé les lignes. Quel prix pour le carrelage ?', resolveRounds),
      ],
      demandState: {
        client: { id: 'c1', name: 'Jean Martin' },
        document: {
          type: 'quote',
          tvaContext: 'réno',
          lines: [{ description: 'Carrelage', quantity: 10, unit: 'm2' }],
        },
      },
      userMessage: 'Finalement c\'est pour Dupont pas Martin',
      expectToolCall: {
        name: 'resolve_client',
        inputContains: { search: 'Dupont' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);

  it('calls generate_quote when all info is ready and user confirms', async () => {
    // All lines are priced in state — AI should go straight to generate_quote
    const scenario: EvalScenario = {
      name: 'generate_quote when state is complete',
      history: [
        userMsg('45 euros le metre'),
        assistantMsg('D\'accord, 45€/m pour le terrassement. Et le polyane ?'),
        userMsg('50 euros'),
        assistantMsg('Parfait. Terrassement 30m à 45€/m et polyane 25m² à 50€/m². Je génère le devis ?'),
      ],
      demandState: {
        client: { id: 'c1', name: 'Jean Martin' },
        document: {
          type: 'quote',
          title: 'Terrassement et polyane',
          tvaContext: 'réno',
          lines: [
            { description: 'Terrassement', quantity: 30, unit: 'm', unitPrice: 4500, tvaRate: 1000 },
            { description: 'Polyane', quantity: 25, unit: 'm2', unitPrice: 5000, tvaRate: 550 },
          ],
        },
      },
      userMessage: 'oui vas-y',
      expectToolCall: {
        name: 'generate_quote',
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);

  it('calls update_line when user gives prices for existing lines', async () => {
    // Lines in state without prices, user now gives prices — AI should use update_line
    const scenario: EvalScenario = {
      name: 'update lines with prices',
      history: [
        userMsg('30m terrassement et 25m2 polyane'),
        assistantMsg('J\'ai noté les lignes. Quel prix pour le terrassement et le polyane ?'),
      ],
      demandState: {
        client: { id: 'c1', name: 'Jean Martin' },
        document: {
          type: 'quote',
          tvaContext: 'réno',
          lines: [
            { description: 'Terrassement', quantity: 30, unit: 'm' },
            { description: 'Polyane', quantity: 25, unit: 'm2' },
          ],
        },
      },
      userMessage: 'terrassement 45 euros et polyane 50 euros',
      expectToolCall: {
        name: 'update_line',
      },
    };

    const result = await runEval(scenario);
    // Accept update_line (ideal) or search_past_pricing (AI proactively checking past pricing)
    if (!result.pass) {
      const firstTool = result.toolCalls[0]?.name;
      expect(firstTool, result.error).toBe('search_past_pricing');
    }
  }, TIMEOUT);

  it('does NOT call generate_quote without resolving client first', async () => {
    // No client in state, but lines are ready — AI must resolve client first
    const scenario: EvalScenario = {
      name: 'no quote without client',
      demandState: {
        client: null,
        document: {
          type: 'quote',
          lines: [
            { description: 'Carrelage', quantity: 10, unit: 'm2', unitPrice: 4500, tvaRate: 1000 },
          ],
        },
      },
      userMessage: 'Fais le devis pour Dupont',
      expectToolCall: {
        name: 'resolve_client',
        inputContains: { search: 'Dupont' },
      },
    };

    const result = await runEval(scenario);
    expect(result.pass, result.error).toBe(true);
  }, TIMEOUT);
});
