import type { TeamField } from '@tuldio/common';
import type { TeamFieldRow } from './team-field.entity.js';

export function toTeamField(row: TeamFieldRow): TeamField {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    value: row.value,
    zone: row.zone,
    scope: row.scope,
    showQuote: row.show_quote,
    showInvoice: row.show_invoice,
    sortOrder: row.sort_order,
    isSystem: row.is_system,
  };
}
