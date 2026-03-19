import { query } from '../../../lib/database/db.js';

interface UnsentProspect {
  id: string;
  profession: string;
  firstName: string;
  fullName: string;
  email: string;
  phone: string | null;
  website: string | null;
}

export async function findUnsentProspects(input: {
  limit: number;
  profession: string | null;
}): Promise<UnsentProspect[]> {
  const params: Array<string | number> = [];
  let where = `WHERE status = 'new' AND sequence_status IS DISTINCT FROM 'active'`;

  if (input.profession) {
    params.push(input.profession);
    where += ` AND profession = $${params.length}`;
  }

  params.push(input.limit);

  const result = await query<UnsentProspect>(
    `SELECT id, profession, first_name AS "firstName", full_name AS "fullName", email, phone, website
     FROM god_prospects
     ${where}
     ORDER BY icp_score DESC NULLS LAST, created_at ASC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows;
}
