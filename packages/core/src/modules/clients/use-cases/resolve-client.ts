import { findClientByEmail } from '../repository/find-client-by-email.js';
import { findClientByPhone } from '../repository/find-client-by-phone.js';
import { searchClients } from '../repository/search-clients.js';
import { toClientView, type ClientView } from '../domain/client.view.js';

type ClientResolution =
  | { status: 'exact_match'; client: ClientView }
  | { status: 'ambiguous'; candidates: ClientView[] }
  | { status: 'no_match' };

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

  // Fuzzy match on name
  const matches = await searchClients({ teamId, search });

  if (matches.length === 0) {
    return { status: 'no_match' };
  }

  // Single high-confidence match — auto-select, no confirmation needed
  if (matches.length === 1 && matches[0]!.score > 0.8) {
    return { status: 'exact_match', client: toClientView(matches[0]!) };
  }

  return {
    status: 'ambiguous',
    candidates: matches.map(toClientView),
  };
}
