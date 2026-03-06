import { query } from '../../../lib/database/db.js';

export async function searchPrestations(input: {
  teamId: string;
  query: string;
  limit?: number;
}): Promise<Array<{
  id: string;
  type: string;
  description: string;
  reference: string | null;
  unit: string;
  defaultUnitPrice: number | null;
  defaultTvaRate: number;
  score: number;
}>> {
  const limit = input.limit ?? 5;
  const result = await query(
    `SELECT id, type, description, reference, unit, default_unit_price, default_tva_rate,
            similarity(description, $2) AS score
     FROM prestations
     WHERE team_id = $1
       AND archived = false
       AND (
         description ILIKE '%' || $2 || '%'
         OR similarity(description, $2) > 0.3
       )
     ORDER BY score DESC
     LIMIT $3`,
    [input.teamId, input.query, limit],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as string,
    description: row.description as string,
    reference: row.reference as string | null,
    unit: row.unit as string,
    defaultUnitPrice: row.default_unit_price as number | null,
    defaultTvaRate: row.default_tva_rate as number,
    score: row.score as number,
  }));
}
