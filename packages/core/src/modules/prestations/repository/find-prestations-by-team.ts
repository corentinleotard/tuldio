import { query } from '../../../lib/database/db.js';

export async function findPrestationsByTeam(input: {
  teamId: string;
  includeArchived?: boolean;
}): Promise<Array<{
  id: string;
  type: string;
  description: string;
  reference: string | null;
  unit: string;
  defaultUnitPrice: number | null;
  defaultTvaRate: number;
  archived: boolean;
}>> {
  const archivedFilter = input.includeArchived ? '' : 'AND archived = false';
  const result = await query(
    `SELECT id, type, description, reference, unit, default_unit_price, default_tva_rate, archived
     FROM prestations
     WHERE team_id = $1 ${archivedFilter}
     ORDER BY description ASC`,
    [input.teamId],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as string,
    description: row.description as string,
    reference: row.reference as string | null,
    unit: row.unit as string,
    defaultUnitPrice: row.default_unit_price as number | null,
    defaultTvaRate: row.default_tva_rate as number,
    archived: row.archived as boolean,
  }));
}
