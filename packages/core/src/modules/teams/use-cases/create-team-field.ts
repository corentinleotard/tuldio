import type { TeamField, CreateTeamFieldRequest } from '@tuldio/common';
import { insertTeamField } from '../repository/insert-team-field.js';
import { findTeamFields } from '../repository/find-team-fields.js';
import { toTeamField } from '../domain/team-field.view.js';

export async function createTeamField(input: {
  teamId: string;
} & CreateTeamFieldRequest): Promise<TeamField> {
  // Generate key from label: lowercase, replace spaces/accents with underscores
  const key = 'custom_' + input.label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  // Find max sort_order in the zone
  const existing = await findTeamFields(input.teamId);
  const zoneFields = existing.filter((f) => f.zone === input.zone);
  const maxSort = zoneFields.reduce((max, f) => Math.max(max, f.sort_order), -1);

  const scope = input.scope ?? 'both';
  const showQuote = scope !== 'invoice';
  const showInvoice = scope !== 'quote';

  const row = await insertTeamField({
    teamId: input.teamId,
    key,
    label: input.label,
    value: input.value ?? '',
    zone: input.zone,
    scope,
    showQuote,
    showInvoice,
    sortOrder: maxSort + 1,
    isSystem: false,
  });

  return toTeamField(row);
}
