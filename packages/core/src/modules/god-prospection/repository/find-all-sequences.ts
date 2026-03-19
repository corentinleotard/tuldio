import { query } from '../../../lib/database/db.js';

export interface GodSequenceRow {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function findAllSequences(): Promise<GodSequenceRow[]> {
  const result = await query<GodSequenceRow>(
    `SELECT id, name, is_active AS "isActive",
            created_at AS "createdAt", updated_at AS "updatedAt"
     FROM god_sequences
     ORDER BY created_at DESC`,
    [],
  );
  return result.rows;
}
