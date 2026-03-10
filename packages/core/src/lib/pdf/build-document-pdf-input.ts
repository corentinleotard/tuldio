import { findTeamById } from '../../modules/teams/repository/find-team-by-id.js';
import { findClientById } from '../../modules/clients/repository/find-client-by-id.js';
import { findTeamFields } from '../../modules/teams/repository/find-team-fields.js';
import { toTeamField } from '../../modules/teams/domain/team-field.view.js';
import { HandledError } from '../errors/handled-error.js';
import { errorCodes } from '../errors/error-codes.js';
import type { GeneratePdfInput } from './generate-pdf.js';

export async function buildDocumentPdfInput(input: {
  type: 'quote' | 'invoice';
  teamId: string;
  id: string;
  number: string;
  clientId: string;
  lines: GeneratePdfInput['lines'];
  totalHt: number;
  totalTtc: number;
  tvaGroups: GeneratePdfInput['tvaGroups'];
  createdAt: Date;
  dueDate?: Date | null;
  validUntil?: Date | null;
  prestationDate?: Date | null;
}): Promise<GeneratePdfInput> {
  const [teamRow, clientRow, fieldRows] = await Promise.all([
    findTeamById(input.teamId),
    findClientById({ teamId: input.teamId, clientId: input.clientId }),
    findTeamFields(input.teamId),
  ]);

  if (!teamRow) throw new HandledError(errorCodes.teamNotFound);
  if (!clientRow) throw new HandledError(errorCodes.clientNotFound);

  return {
    type: input.type,
    id: input.id,
    number: input.number,
    team: { name: teamRow.name, logoUrl: teamRow.logo_url, fields: fieldRows.map(toTeamField) },
    client: {
      name: clientRow.first_name + ' ' + clientRow.last_name,
      email: clientRow.email,
      phone: clientRow.phone,
      address: clientRow.address,
    },
    lines: input.lines,
    totalHt: input.totalHt,
    totalTtc: input.totalTtc,
    tvaGroups: input.tvaGroups,
    createdAt: input.createdAt,
    dueDate: input.dueDate,
    validUntil: input.validUntil,
    prestationDate: input.prestationDate,
  };
}
