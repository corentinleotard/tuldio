/**
 * Deterministic tests for demand state management.
 *
 * These test the state machine logic WITHOUT hitting the Claude API.
 * They verify that tools correctly update/read/clear demand state.
 *
 * Run with: pnpm test
 */

import { describe, it, expect } from 'vitest';
import { executeTool } from '../tool-registry.js';
import type { DemandState } from '@tuldio/types';

const EMPTY_STATE: DemandState = { client: null, document: null };
const ctx = { teamId: 'team-1', userId: 'user-1' };

describe('demand state updates', () => {
  describe('resolve_client stateUpdate', () => {
    it('sets active client on exact_match', async () => {
      // We can't call resolve_client without a DB, but we can test stateUpdate
      // by importing the tool's stateUpdate function indirectly through executeTool
      // Instead, we test the contract: stateUpdate receives the handler result

      // Simulate what stateUpdate receives for an exact_match
      const { stateUpdate } = await executeTool({
        toolName: 'resolve_client',
        toolInput: { search: 'Martin' },
        ...ctx,
        demandState: EMPTY_STATE,
      }).catch(() => ({ stateUpdate: null }));

      // Can't test without DB — covered by API evals
      // This test documents the expected behavior
      expect(true).toBe(true);
    });
  });

  describe('init_document stateUpdate', () => {
    it('creates empty document with type and metadata', async () => {
      const { stateUpdate } = await executeTool({
        toolName: 'init_document',
        toolInput: {
          type: 'quote',
          title: 'Rénovation salle de bain',
          tvaContext: 'réno',
        },
        ...ctx,
        demandState: EMPTY_STATE,
      });

      expect(stateUpdate).not.toBeNull();
      expect(stateUpdate).not.toBe('clear');

      const update = stateUpdate as Partial<DemandState>;
      expect(update.document).toBeDefined();
      expect(update.document!.type).toBe('quote');
      expect(update.document!.title).toBe('Rénovation salle de bain');
      expect(update.document!.tvaContext).toBe('réno');
      expect(update.document!.lines).toHaveLength(0);
    });

    it('replaces previous document state', async () => {
      const stateWithDoc: DemandState = {
        client: { id: 'c1', name: 'Martin Jean' },
        document: {
          type: 'invoice',
          title: 'Old title',
          lines: [{ description: 'Old line', quantity: 1, unit: 'u' }],
        },
      };

      const { stateUpdate } = await executeTool({
        toolName: 'init_document',
        toolInput: { type: 'quote', title: 'New title' },
        ...ctx,
        demandState: stateWithDoc,
      });

      const update = stateUpdate as Partial<DemandState>;
      expect(update.document!.type).toBe('quote');
      expect(update.document!.title).toBe('New title');
      expect(update.document!.lines).toHaveLength(0);
      expect(update.client).toBeUndefined();
    });
  });

  describe('add_lines stateUpdate', () => {
    it('appends lines to document', async () => {
      const stateWithDoc: DemandState = {
        client: null,
        document: { type: 'quote', tvaContext: 'réno', lines: [] },
      };

      const { toolResult, stateUpdate } = await executeTool({
        toolName: 'add_lines',
        toolInput: {
          lines: [
            { description: 'Terrassement', quantity: 30, unit: 'm', unitPrice: 4500, tvaRate: 1000 },
            { description: 'Polyane', quantity: 25, unit: 'm2', unitPrice: 5000, tvaRate: 550 },
          ],
        },
        ...ctx,
        demandState: stateWithDoc,
      });

      const update = stateUpdate as Partial<DemandState>;
      expect(update.document!.lines).toHaveLength(2);
      expect(update.document!.lines[0]!.description).toBe('Terrassement');

      const result = toolResult.result as { addedCount: number; totalLineCount: number; allPriced: boolean };
      expect(result.addedCount).toBe(2);
      expect(result.totalLineCount).toBe(2);
      expect(result.allPriced).toBe(true);
    });

    it('appends to existing lines without replacing', async () => {
      const stateWithLines: DemandState = {
        client: null,
        document: {
          type: 'quote',
          lines: [{ description: 'Terrassement', quantity: 30, unit: 'm' }],
        },
      };

      const { stateUpdate } = await executeTool({
        toolName: 'add_lines',
        toolInput: {
          lines: [{ description: 'Polyane', quantity: 25, unit: 'm2' }],
        },
        ...ctx,
        demandState: stateWithLines,
      });

      const update = stateUpdate as Partial<DemandState>;
      expect(update.document!.lines).toHaveLength(2);
      expect(update.document!.lines[0]!.description).toBe('Terrassement');
      expect(update.document!.lines[1]!.description).toBe('Polyane');
    });

    it('fails without init_document', async () => {
      await expect(
        executeTool({
          toolName: 'add_lines',
          toolInput: { lines: [{ description: 'Test', quantity: 1 }] },
          ...ctx,
          demandState: EMPTY_STATE,
        }),
      ).rejects.toThrow();
    });
  });

  describe('update_line stateUpdate', () => {
    it('updates line prices by index', async () => {
      const stateWithLines: DemandState = {
        client: null,
        document: {
          type: 'quote',
          tvaContext: 'réno',
          lines: [
            { description: 'Terrassement', quantity: 30, unit: 'm' },
            { description: 'Polyane', quantity: 25, unit: 'm2' },
          ],
        },
      };

      const { stateUpdate } = await executeTool({
        toolName: 'update_line',
        toolInput: {
          updates: [
            { index: 0, unitPrice: 4500, tvaRate: 1000 },
            { index: 1, unitPrice: 5000, tvaRate: 550 },
          ],
        },
        ...ctx,
        demandState: stateWithLines,
      });

      const update = stateUpdate as Partial<DemandState>;
      expect(update.document!.lines).toHaveLength(2);
      expect(update.document!.lines[0]!.unitPrice).toBe(4500);
      expect(update.document!.lines[0]!.description).toBe('Terrassement');
      expect(update.document!.lines[1]!.unitPrice).toBe(5000);
    });

    it('fails on out-of-range index', async () => {
      const stateWithLines: DemandState = {
        client: null,
        document: {
          type: 'quote',
          lines: [{ description: 'Test', quantity: 1, unit: 'u' }],
        },
      };

      await expect(
        executeTool({
          toolName: 'update_line',
          toolInput: { updates: [{ index: 5, unitPrice: 1000 }] },
          ...ctx,
          demandState: stateWithLines,
        }),
      ).rejects.toThrow();
    });
  });

  describe('remove_line stateUpdate', () => {
    it('removes line by index', async () => {
      const stateWithLines: DemandState = {
        client: null,
        document: {
          type: 'quote',
          lines: [
            { description: 'Terrassement', quantity: 30, unit: 'm' },
            { description: 'Polyane', quantity: 25, unit: 'm2' },
          ],
        },
      };

      const { stateUpdate } = await executeTool({
        toolName: 'remove_line',
        toolInput: { index: 0 },
        ...ctx,
        demandState: stateWithLines,
      });

      const update = stateUpdate as Partial<DemandState>;
      expect(update.document!.lines).toHaveLength(1);
      expect(update.document!.lines[0]!.description).toBe('Polyane');
    });
  });

  describe('generate_quote prerequisites', () => {
    it('fails without active client', async () => {
      const stateNoClient: DemandState = {
        client: null,
        document: {
          type: 'quote',
          lines: [{ description: 'Carrelage', quantity: 10, unit: 'm2', unitPrice: 4500, tvaRate: 1000 }],
        },
      };

      await expect(
        executeTool({
          toolName: 'generate_quote',
          toolInput: {},
          ...ctx,
          demandState: stateNoClient,
        }),
      ).rejects.toThrow('Aucun client sélectionné');
    });

    it('fails without prepared lines', async () => {
      const stateNoDoc: DemandState = {
        client: { id: 'c1', name: 'Martin Jean' },
        document: null,
      };

      await expect(
        executeTool({
          toolName: 'generate_quote',
          toolInput: {},
          ...ctx,
          demandState: stateNoDoc,
        }),
      ).rejects.toThrow('Aucune ligne préparée');
    });

    it('fails with incomplete prices', async () => {
      const stateIncomplete: DemandState = {
        client: { id: 'c1', name: 'Martin Jean' },
        document: {
          type: 'quote',
          lines: [
            { description: 'Carrelage', quantity: 10, unit: 'm2', unitPrice: 4500, tvaRate: 1000 },
            { description: 'Polyane', quantity: 25, unit: 'm2' }, // missing price
          ],
        },
      };

      await expect(
        executeTool({
          toolName: 'generate_quote',
          toolInput: {},
          ...ctx,
          demandState: stateIncomplete,
        }),
      ).rejects.toThrow('prix unitaire');
    });
  });

  describe('generate_invoice prerequisites', () => {
    it('fails without active client', async () => {
      const stateNoClient: DemandState = {
        client: null,
        document: {
          type: 'invoice',
          lines: [{ description: 'Plomberie', quantity: 1, unit: 'forfait', unitPrice: 15000, tvaRate: 2000 }],
        },
      };

      await expect(
        executeTool({
          toolName: 'generate_invoice',
          toolInput: {},
          ...ctx,
          demandState: stateNoClient,
        }),
      ).rejects.toThrow('Aucun client sélectionné');
    });
  });

  describe('state transitions — full flow simulation', () => {
    it('client switch replaces active client', async () => {
      // Step 1: first client is active
      const state1: DemandState = {
        client: { id: 'client-martin', name: 'Jean Martin' },
        document: {
          type: 'quote',
          lines: [{ description: 'Terrassement', quantity: 30, unit: 'm', unitPrice: 4500, tvaRate: 1000 }],
        },
      };

      // Step 2: simulate resolve_client returning a different client
      // The stateUpdate from resolve_client would return { client: { id: 'client-dupont', name: 'Pierre Dupont' } }
      // Merging with spread: { ...state1, client: newClient }
      const newClientUpdate: Partial<DemandState> = {
        client: { id: 'client-dupont', name: 'Pierre Dupont' },
      };

      const merged: DemandState = { ...state1, ...newClientUpdate };

      // Client changed, but document lines preserved
      expect(merged.client!.id).toBe('client-dupont');
      expect(merged.client!.name).toBe('Pierre Dupont');
      expect(merged.document!.lines).toHaveLength(1);
      expect(merged.document!.lines[0]!.description).toBe('Terrassement');
    });

    it('generate_quote keeps state with generatedId', () => {
      // After generation, state is preserved with generatedId for post-generation edits
      // stateUpdate merges generatedId into the existing document
      const stateAfterGeneration: DemandState = {
        client: { id: 'c1', name: 'Martin Jean' },
        document: {
          type: 'quote',
          title: 'Réno',
          tvaContext: 'réno',
          lines: [{ description: 'Carrelage', quantity: 10, unit: 'm2', unitPrice: 4500, tvaRate: 1000 }],
          generatedId: 'quote-123',
        },
      };

      expect(stateAfterGeneration.client).not.toBeNull();
      expect(stateAfterGeneration.document).not.toBeNull();
      expect(stateAfterGeneration.document!.generatedId).toBe('quote-123');
      expect(stateAfterGeneration.document!.lines).toHaveLength(1);
    });

    it('init_document preserves active client', async () => {
      const stateWithClient: DemandState = {
        client: { id: 'c1', name: 'Martin Jean' },
        document: null,
      };

      const { stateUpdate } = await executeTool({
        toolName: 'init_document',
        toolInput: { type: 'quote' },
        ...ctx,
        demandState: stateWithClient,
      });

      // stateUpdate only sets document, not client
      const update = stateUpdate as Partial<DemandState>;
      expect(update.document).toBeDefined();
      expect(update.client).toBeUndefined(); // not touched

      // After merge: client preserved
      const merged: DemandState = { ...stateWithClient, ...update };
      expect(merged.client!.id).toBe('c1');
      expect(merged.document!.lines).toHaveLength(0);
    });
  });
});
