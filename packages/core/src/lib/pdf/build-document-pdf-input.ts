import { toTeamField } from '../../modules/teams/domain/team-field.view.js';
import { fetchDocumentContext } from '../../modules/documents/repository/fetch-document-context.js';
import { getClientDisplayName } from '../../modules/clients/domain/get-client-display-name.js';
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
  invoiceType?: string;
  sourceInvoiceNumber?: string | null;
  situationNumber?: number | null;
}): Promise<GeneratePdfInput> {
  const { team, client, teamFields } = await fetchDocumentContext({
    teamId: input.teamId,
    clientId: input.clientId,
  });

  return {
    type: input.type,
    id: input.id,
    number: input.number,
    team: { name: team.name, logoUrl: team.logo_url, fields: teamFields.map(toTeamField) },
    client: {
      name: getClientDisplayName(client),
      siret: client.siret,
      tvaNumber: client.tva_number,
      email: client.email,
      phone: client.phone,
      address: client.address,
    },
    lines: input.lines,
    totalHt: input.totalHt,
    totalTtc: input.totalTtc,
    tvaGroups: input.tvaGroups,
    createdAt: input.createdAt,
    dueDate: input.dueDate,
    validUntil: input.validUntil,
    prestationDate: input.prestationDate,
    invoiceType: input.invoiceType,
    sourceInvoiceNumber: input.sourceInvoiceNumber,
    situationNumber: input.situationNumber,
  };
}
