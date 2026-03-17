import { query } from '../../../lib/database/db.js';

interface SentProspectRow {
  profession: string;
  firstName: string;
  fullName: string;
  email: string;
  phone: string | null;
  sentAt: Date | null;
  sentSubject: string | null;
  sentBodyHtml: string | null;
}

export async function findSentProspects(input: {
  limit: number;
  offset: number;
}): Promise<{ rows: SentProspectRow[]; total: number }> {
  const [dataResult, countResult] = await Promise.all([
    query<SentProspectRow>(
      `SELECT profession, first_name AS "firstName", full_name AS "fullName",
              email, phone, sent_at AS "sentAt",
              sent_subject AS "sentSubject", sent_body_html AS "sentBodyHtml"
       FROM god_prospects
       WHERE status = 'sent'
       ORDER BY sent_at DESC NULLS LAST
       LIMIT $1 OFFSET $2`,
      [input.limit, input.offset],
    ),
    query<{ count: string }>(
      `SELECT count(*)::text AS count FROM god_prospects WHERE status = 'sent'`,
      [],
    ),
  ]);

  return {
    rows: dataResult.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0', 10),
  };
}
