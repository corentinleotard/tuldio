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
  hasMobile: boolean;
  status: string;
  sequenceStatus: string | null;
}

export async function findSendQueue(input: {
  profession: string | null;
  limit: number;
  includeContacted: boolean;
}): Promise<SendQueueProspect[]> {
  const params: Array<string | number> = [];
  let where: string;

  if (input.includeContacted) {
    // All prospects assignable to a sequence (not currently active in one)
    where = `WHERE sequence_status IS DISTINCT FROM 'active'`;
  } else {
    // Only uncontacted prospects (original behavior)
    where = `WHERE status = 'new' AND sequence_status IS DISTINCT FROM 'active'`;
  }

  if (input.profession) {
    params.push(input.profession);
    where += ` AND profession = $${params.length}`;
  }

  params.push(input.limit);

  const result = await query<SendQueueProspect>(
    `SELECT id, profession, full_name AS "fullName", email, phone, website,
            icp_score AS "icpScore", icp_reason AS "icpReason",
            (COALESCE(phone, '') ~ '^(\\+33[67]|0[67])') AS "hasMobile",
            status,
            sequence_status AS "sequenceStatus"
     FROM god_prospects
     ${where}
     ORDER BY
       (COALESCE(phone, '') ~ '^(\\+33[67]|0[67])') DESC,
       icp_score DESC NULLS LAST,
       created_at ASC
     LIMIT $${params.length}`,
    params,
  );

  return result.rows;
}
