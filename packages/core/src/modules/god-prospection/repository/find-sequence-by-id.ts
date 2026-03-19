import { query } from '../../../lib/database/db.js';
import type { GodSequenceRow } from './find-all-sequences.js';

export async function findSequenceById(input: {
  id: string;
}): Promise<GodSequenceRow | null> {
  const result = await query<GodSequenceRow>(
    `SELECT id, name, is_active AS "isActive",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM god_sequences
     WHERE id = $1`,
    [input.id],
  );
  return result.rows[0] ?? null;
}
