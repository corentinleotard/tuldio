import { query } from '../../../lib/database/db.js';

interface UnsentProspect {
  id: string;
  profession: string;
  firstName: string;
  fullName: string;
  email: string;
  phone: string | null;
}

export async function findUnsentProspects(input: {
  limit: number;
}): Promise<UnsentProspect[]> {
  const result = await query<UnsentProspect>(
    `SELECT id, profession, first_name AS "firstName", full_name AS "fullName", email, phone
     FROM god_prospects
     WHERE status = 'new'
     ORDER BY created_at ASC
     LIMIT $1`,
    [input.limit],
  );

  return result.rows;
}
