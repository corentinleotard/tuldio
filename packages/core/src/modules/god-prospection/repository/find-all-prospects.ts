import { query } from '../../../lib/database/db.js';

interface ProspectRow {
  id: string;
  profession: string;
  firstName: string;
  fullName: string;
  email: string;
  phone: string | null;
  source: string;
  status: string;
  sentAt: Date | null;
  scraped: boolean;
  createdAt: Date;
}

export async function findAllProspects(input?: {
  limit?: number;
}): Promise<ProspectRow[]> {
  const limit = input?.limit ?? 10000;
  const result = await query<ProspectRow>(
    `SELECT id, profession, first_name AS "firstName", full_name AS "fullName",
            email, phone, source, status, sent_at AS "sentAt",
            scraped, created_at AS "createdAt"
     FROM god_prospects
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );

  return result.rows;
}
