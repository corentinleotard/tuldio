import { findUnitByExactMatch, findUnitByCaseInsensitive, findUnitByFuzzy } from '../repository/find-unit.js';
import { insertUnit } from '../repository/insert-unit.js';

interface ResolvedUnit {
  id: string;
  label: string;
}

export async function resolveUnit(input: {
  teamId: string;
  raw: string;
}): Promise<ResolvedUnit> {
  const trimmed = input.raw.trim();

  // 1. Exact match on label or alias
  const exact = await findUnitByExactMatch({ teamId: input.teamId, raw: trimmed });
  if (exact) return exact;

  // 2. Case-insensitive match on label or alias
  const caseInsensitive = await findUnitByCaseInsensitive({ teamId: input.teamId, raw: trimmed });
  if (caseInsensitive) return caseInsensitive;

  // 3. Fuzzy match on label (trigram similarity)
  const fuzzy = await findUnitByFuzzy({ teamId: input.teamId, raw: trimmed });
  if (fuzzy) return fuzzy;

  // 4. No match — create team-specific unit
  return insertUnit({ teamId: input.teamId, label: trimmed });
}
