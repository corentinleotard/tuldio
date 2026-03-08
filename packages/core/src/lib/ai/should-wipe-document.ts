import type { DemandDocument } from '@tuldio/types';

/**
 * Determines whether the document state should be wiped when resolving or creating a client.
 *
 * - No document in progress → wipe (no-op, already null)
 * - Intent is 'switch_recipient' → keep (user is correcting the client on the current draft)
 * - Different client with 'new' intent → wipe (new client = new demand)
 * - Same client, document already generated (has generatedId) → wipe (new demand, start fresh)
 * - Same client, document in progress → keep (user is refining the same quote)
 */
export function shouldWipeDocument(input: {
  document: DemandDocument | null;
  currentClientId: string | null;
  newClientId: string;
  intent: 'new' | 'switch_recipient';
}): boolean {
  if (!input.document) return true;
  if (input.intent === 'switch_recipient') return false;
  if (input.currentClientId !== input.newClientId) return true;
  return !!input.document.generatedId;
}
