import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { findTeamFields } from '../../teams/repository/find-team-fields.js';
import type { TeamRow } from '../../teams/domain/team.entity.js';
import type { ClientRow } from '../../clients/domain/client.entity.js';
import type { TeamFieldRow } from '../../teams/domain/team-field.entity.js';

export interface DocumentContext {
  team: TeamRow;
  client: ClientRow;
  teamFields: TeamFieldRow[];
}

/**
 * Fetches team, client, and team fields in parallel.
 * Used by status transition use-cases and PDF generation.
 * Throws if team or client not found.
 */
export async function fetchDocumentContext(input: {
  teamId: string;
  clientId: string;
}): Promise<DocumentContext> {
  const [team, client, teamFields] = await Promise.all([
    findTeamById(input.teamId),
    findClientById({ teamId: input.teamId, clientId: input.clientId }),
    findTeamFields(input.teamId),
  ]);

  if (!team) throw new HandledError(errorCodes.teamNotFound);
  if (!client) throw new HandledError(errorCodes.clientNotFound);

  return { team, client, teamFields };
}
