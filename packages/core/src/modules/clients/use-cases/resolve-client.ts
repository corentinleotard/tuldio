import { findClientByEmail } from '../repository/find-client-by-email.js';
import { findClientByPhone } from '../repository/find-client-by-phone.js';
import { searchClients } from '../repository/search-clients.js';
import { toClientView, type ClientView } from '../domain/client.view.js';

export type ClientResolution =
  | { status: 'exact_match'; client: ClientView }
  | { status: 'ambiguous'; candidates: ClientView[] }
  | { status: 'no_match' };

// Threshold for full-name trigram similarity (pg_trgm) to auto-select a single match.
// Uses GREATEST(similarity(first+last, search), similarity(last+first, search)) — both
// name orders checked, but individual component scores (last name alone) are excluded
// to avoid false positives when only the last name matches.
//
// Measured scores (pg_trgm):
//   Accent removed  "Corentin Leotard"   vs "Corentin Léotard"   → 0.70  ✓ auto-select
//   Minor typo      "Corentin Léotart"   vs "Corentin Léotard"   → 0.79  ✓ auto-select
//   Swapped letter  "Corentni Léotard"   vs "Corentin Léotard"   → 0.70  ✓ auto-select
//   Missing letter  "Jean Matin"         vs "Jean Martin"        → 0.64  ✓ auto-select
//   Different first "Maurice Léotard"    vs "Corentin Léotard"   → 0.32  ✗ ambiguous
//   Similar first   "Constantin Léotard" vs "Corentin Léotard"   → 0.57  ✗ ambiguous
//   Partial first   "Pierre Dupont"      vs "Jean-Pierre Dupont" → 0.74  ✓ auto-select
const FULL_NAME_EXACT_MATCH_THRESHOLD = 0.6;

export async function resolveClient(input: {
  teamId: string;
  search: string;
  email?: string;
  phone?: string;
}): Promise<ClientResolution> {
  const { teamId, search, email, phone } = input;

  // Hard match: email (unique per team)
  if (email) {
    const byEmail = await findClientByEmail({ teamId, email });
    if (byEmail) {
      return { status: 'exact_match', client: toClientView(byEmail) };
    }
  }

  // Hard match: phone (unique per team)
  if (phone) {
    const byPhone = await findClientByPhone({ teamId, phone });
    if (byPhone) {
      return { status: 'exact_match', client: toClientView(byPhone) };
    }
  }

  // Fuzzy match on name — cap to 20, enough for disambiguation
  const matches = await searchClients({ teamId, search, limit: 20 });

  if (matches.length === 0) {
    return { status: 'no_match' };
  }

  // Single high-confidence match on full name — auto-select
  if (matches.length === 1 && matches[0]!.full_name_score > FULL_NAME_EXACT_MATCH_THRESHOLD) {
    return { status: 'exact_match', client: toClientView(matches[0]!) };
  }

  return {
    status: 'ambiguous',
    candidates: matches.map(toClientView),
  };
}
