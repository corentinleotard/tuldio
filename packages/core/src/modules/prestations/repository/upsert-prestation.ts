import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';

export async function upsertPrestation(input: {
  teamId: string;
  type: 'service' | 'fourniture';
  description: string;
  reference?: string | null;
  unit: string;
  defaultUnitPrice?: number | null;
  defaultTvaRate: number;
}): Promise<string> {
  // Check for existing close match
  const existing = await query(
    `SELECT id FROM prestations
     WHERE team_id = $1
       AND archived = false
       AND (
         similarity(description, $2) > 0.8
         OR (reference IS NOT NULL AND reference = $3)
       )
     ORDER BY similarity(description, $2) DESC
     LIMIT 1`,
    [input.teamId, input.description, input.reference ?? null],
  );

  if (existing.rows.length > 0) {
    const id = (existing.rows[0] as { id: string }).id;
    // Update price if provided (keep catalog up to date)
    if (input.defaultUnitPrice !== undefined && input.defaultUnitPrice !== null) {
      await query(
        `UPDATE prestations SET default_unit_price = $1 WHERE id = $2 AND team_id = $3`,
        [input.defaultUnitPrice, id, input.teamId],
      );
    }
    return id;
  }

  const id = generateId();
  await query(
    `INSERT INTO prestations (id, team_id, type, description, reference, unit, default_unit_price, default_tva_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, input.teamId, input.type, input.description, input.reference ?? null, input.unit, input.defaultUnitPrice ?? null, input.defaultTvaRate],
  );

  return id;
}
