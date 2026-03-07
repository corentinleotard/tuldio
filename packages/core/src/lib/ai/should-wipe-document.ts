import type { DemandDocument } from '@tuldio/types';

/**
 * Determines whether the document state should be wiped when resolving or creating a client.
 *
 * - No document in progress → wipe (no-op, already null)
 * - Document in progress, not yet generated → keep (user is switching recipient)
 * - Document already generated (has generatedId) → wipe (new demand, start fresh)
 */
export function shouldWipeDocument(document: DemandDocument | null): boolean {
  if (!document) return true;
  return !!document.generatedId;
}
