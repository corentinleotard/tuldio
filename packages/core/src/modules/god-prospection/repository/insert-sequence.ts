import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';

export async function insertSequence(input: {
  name: string;
}): Promise<{ id: string }> {
  const id = generateId();
  await query(
    `INSERT INTO god_sequences (id, name)
     VALUES ($1, $2)`,
    [id, input.name],
  );
  return { id };
}
