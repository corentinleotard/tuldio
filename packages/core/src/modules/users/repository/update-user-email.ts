import { query } from '../../../lib/database/db.js';

export async function updateUserEmail(input: {
  userId: string;
  email: string;
}): Promise<void> {
  await query(
    'UPDATE users SET email = $2 WHERE id = $1',
    [input.userId, input.email],
  );
}
