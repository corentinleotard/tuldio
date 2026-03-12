export type EntityType = 'client' | 'quote' | 'invoice';

export type RefEntry = { type: EntityType; id: string };

export type RefMap = Map<string, RefEntry>;

export type StoredRef = { ref: string; type: string; id: string };

export type RefCounters = { client: number; document: number };

export function createRefMap(): RefMap {
  return new Map();
}

export function createRefCounters(): RefCounters {
  return { client: 0, document: 0 };
}

/** Register a new entity and return its ref alias (e.g. "c1", "d2") */
export function registerRef(input: {
  refMap: RefMap;
  type: EntityType;
  id: string;
  counters: RefCounters;
}): string {
  const { refMap, type, id, counters } = input;

  // Check if this entity already has a ref
  for (const [ref, entry] of refMap) {
    if (entry.type === type && entry.id === id) return ref;
  }

  const isClient = type === 'client';
  const prefix = isClient ? 'c' : 'd';
  const counterKey = isClient ? 'client' : 'document';
  const index = counters[counterKey];
  counters[counterKey]++;

  const ref = `${prefix}${index}`;
  refMap.set(ref, { type, id });
  return ref;
}

/** Resolve a ref to a UUID. Throws a descriptive string if ref is unknown. */
export function resolveRef(input: {
  refMap: RefMap;
  ref: string;
  expectedType?: EntityType;
}): string {
  const entry = input.refMap.get(input.ref);
  if (!entry) {
    throw new Error(`Unknown ref: ${input.ref}. Use find_clients or find_documents to search again.`);
  }
  if (input.expectedType && entry.type !== input.expectedType) {
    throw new Error(`Ref ${input.ref} is a ${entry.type}, expected ${input.expectedType}.`);
  }
  return entry.id;
}

/** Get the full ref entry (type + id) for a ref. Returns null if unknown. */
export function getRefEntry(input: { refMap: RefMap; ref: string }): RefEntry | null {
  return input.refMap.get(input.ref) ?? null;
}

/** Look up an entity by ID in the ref map. Returns its ref key or null. */
export function findRefByEntityId(refMap: RefMap, type: EntityType, id: string): string | null {
  for (const [ref, entry] of refMap) {
    if (entry.type === type && entry.id === id) return ref;
  }
  return null;
}

/**
 * Build a ref map from recent messages' stored tool calls + active state.
 *
 * 1. Replay stored refs as-is (stable keys the AI already saw)
 * 2. Register active state entities only if not already in the map
 *    (guarantees the AI always has a ref for the active client/document)
 */
export function buildRefMap(input: {
  activeState: { client: { id: string } | null; document: { id: string; type: 'quote' | 'invoice' } | null };
  recentToolCalls: Array<{ refs?: StoredRef[] }>;
}): { refMap: RefMap; counters: RefCounters } {
  const refMap = createRefMap();
  const counters = createRefCounters();

  // 1. Replay stored refs under their original keys
  for (const tc of input.recentToolCalls) {
    if (!tc.refs) continue;
    for (const storedRef of tc.refs) {
      if (refMap.has(storedRef.ref)) continue;

      const entityType = storedRef.type as EntityType;
      refMap.set(storedRef.ref, { type: entityType, id: storedRef.id });

      // Advance counter past this number to avoid collisions
      const isClient = entityType === 'client';
      const counterKey = isClient ? 'client' : 'document';
      const refNum = parseInt(storedRef.ref.slice(1));
      if (!isNaN(refNum) && refNum >= counters[counterKey]) {
        counters[counterKey] = refNum + 1;
      }
    }
  }

  // 2. Ensure active state entities have a ref (may already exist from step 1)
  if (input.activeState.client) {
    const existing = findRefByEntityId(refMap, 'client', input.activeState.client.id);
    if (!existing) {
      registerRef({ refMap, type: 'client', id: input.activeState.client.id, counters });
    }
  }
  if (input.activeState.document) {
    const existing = findRefByEntityId(refMap, input.activeState.document.type, input.activeState.document.id);
    if (!existing) {
      registerRef({ refMap, type: input.activeState.document.type, id: input.activeState.document.id, counters });
    }
  }

  return { refMap, counters };
}

/** Backwards compatibility: migrate old-format StoredToolCall to new format with refs */
export function migrateStoredToolCall(tc: {
  toolUseId: string;
  name: string;
  input: unknown;
  result: unknown;
  refs?: StoredRef[];
}): {
  toolUseId: string;
  name: string;
  input: unknown;
  result: unknown;
  refs?: StoredRef[];
} {
  // Already has refs — no migration needed
  if (tc.refs) return tc;

  const refs: StoredRef[] = [];
  const result = tc.result as Record<string, unknown> | null;

  // Skip obsolete tools
  if (tc.name === 'detect_client') {
    return { ...tc, name: 'detect_client', result: {}, refs: [] };
  }

  // Map old tool names
  let name = tc.name;
  if (name === 'resolve_client') name = 'find_clients';
  if (name === 'open_document') name = 'get_document';
  if (name === 'get_active_document') name = 'get_document';

  // Extract entity IDs from old fat results
  if (result && typeof result === 'object') {
    // Client references
    if ('id' in result && typeof result.id === 'string') {
      if (tc.name === 'create_client' || tc.name === 'resolve_client' || tc.name === 'update_client') {
        refs.push({ ref: `c_migrated_${result.id}`, type: 'client', id: result.id });
      }
    }
    // Resolution results with client field
    if ('client' in result && result.client && typeof result.client === 'object') {
      const client = result.client as Record<string, unknown>;
      if ('id' in client && typeof client.id === 'string') {
        refs.push({ ref: `c_migrated_${client.id}`, type: 'client', id: client.id });
      }
    }
    // Document references
    if ('id' in result && typeof result.id === 'string') {
      if (tc.name === 'create_document' || tc.name === 'update_document' || tc.name === 'update_quote' || tc.name === 'update_invoice' || tc.name === 'open_document' || tc.name === 'get_active_document') {
        const docType = 'number' in result && typeof result.number === 'string'
          ? (result.number.startsWith('F-') ? 'invoice' : 'quote')
          : 'quote';
        refs.push({ ref: `d_migrated_${result.id}`, type: docType, id: result.id });
      }
    }
  }

  // Trim old fat results to minimal format
  const minimalResult = trimOldResult(tc.name, result);

  return { ...tc, name, result: minimalResult, refs };
}

function trimOldResult(toolName: string, result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const r = result as Record<string, unknown>;

  // For documents, keep just id + number + type + status
  if (toolName === 'create_document' || toolName === 'update_document' || toolName === 'update_quote' || toolName === 'update_invoice' || toolName === 'open_document' || toolName === 'get_active_document') {
    if ('id' in r && 'number' in r) {
      return { id: r.id, number: r.number, status: r.status };
    }
  }

  // For client resolution, keep just status + client summary
  if (toolName === 'resolve_client') {
    if ('status' in r) {
      return { status: r.status };
    }
  }

  return result;
}
