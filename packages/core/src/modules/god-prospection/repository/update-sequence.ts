import { query } from '../../../lib/database/db.js';

export async function updateSequence(input: {
  id: string;
  name?: string;
  isActive?: boolean;
}): Promise<void> {
  const sets: string[] = ['updated_at = now()'];
  const params: Array<string | boolean> = [];

  if (input.name !== undefined) {
    params.push(input.name);
    sets.push(`name = $${params.length}`);
  }

  if (input.isActive !== undefined) {
    params.push(input.isActive);
    sets.push(`is_active = $${params.length}`);
  }

  params.push(input.id);

  await query(
    `UPDATE god_sequences SET ${sets.join(', ')} WHERE id = $${params.length}`,
    params,
  );
}
