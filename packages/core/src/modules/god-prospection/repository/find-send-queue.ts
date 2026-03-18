import { query } from '../../../lib/database/db.js';

export interface SendQueueProspect {
  id: string;
  profession: string;
  fullName: string;
  email: string;
  phone: string | null;
  website: string | null;
  icpScore: number | null;
  icpReason: string | null;
}

export async function findSendQueue(input: {
  profession: string | null;
  limit: number;
}): Promise<SendQueueProspect[]> {
  const params: Array<string | number> = [];
  let where = `WHERE status = 'new'`;

  if (input.profession) {
    params.push(input.profession);
    where += ` AND profession = $${params.length}`;
  }

  params.push(input.limit);

  const result = await query<SendQueueProspect>(
    `SELECT id, profession, full_name AS "fullName", email, phone, website,
            icp_score AS "icpScore", icp_reason AS "icpReason"
     FROM god_prospects
     ${where}
     ORDER BY icp_score DESC NULLS LAST, created_at ASC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows;
}
