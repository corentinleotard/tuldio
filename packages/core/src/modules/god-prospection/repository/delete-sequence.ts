import { query } from '../../../lib/database/db.js';

export async function deleteSequence(input: {
  id: string;
}): Promise<void> {
  await query(
    `DELETE FROM god_sequences WHERE id = $1`,
    [input.id],
  );
}
