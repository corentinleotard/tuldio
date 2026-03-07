import { query } from '../../../lib/database/db.js';

interface UnitRow {
  id: string;
  label: string;
}

export async function findUnitByExactMatch(input: {
  teamId: string;
  raw: string;
}): Promise<UnitRow | null> {
  const result = await query(
    `SELECT id, label FROM units
     WHERE (team_id = $1 OR team_id IS NULL)
       AND (
         label = $2
         OR $2 = ANY(aliases)
       )
     ORDER BY team_id NULLS LAST
     LIMIT 1`,
    [input.teamId, input.raw],
  );
  return (result.rows[0] as UnitRow) ?? null;
}

export async function findUnitByCaseInsensitive(input: {
  teamId: string;
  raw: string;
}): Promise<UnitRow | null> {
  const result = await query(
    `SELECT id, label FROM units
     WHERE (team_id = $1 OR team_id IS NULL)
       AND (
         LOWER(label) = LOWER($2)
         OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE LOWER(a) = LOWER($2))
       )
     ORDER BY team_id NULLS LAST
     LIMIT 1`,
    [input.teamId, input.raw],
  );
  return (result.rows[0] as UnitRow) ?? null;
}

export async function findUnitByFuzzy(input: {
  teamId: string;
  raw: string;
}): Promise<UnitRow | null> {
  const result = await query(
    `SELECT id, label, similarity(label, $2) AS score FROM units
     WHERE (team_id = $1 OR team_id IS NULL)
       AND similarity(label, $2) > 0.4
     ORDER BY score DESC
     LIMIT 1`,
    [input.teamId, input.raw],
  );
  return (result.rows[0] as UnitRow) ?? null;
}
