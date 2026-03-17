import { query } from '../../../lib/database/db.js';

interface ProfessionStat {
  profession: string;
  total: number;
  newCount: number;
  sent: number;
  error: number;
  formContacted: number;
  avgScore: number | null;
}

interface ProspectReportRow {
  id: string;
  profession: string;
  fullName: string;
  email: string;
  website: string | null;
  status: string;
  contactedVia: string | null;
  icpScore: number | null;
  icpReason: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

export async function findProspectStats(): Promise<{
  byProfession: ProfessionStat[];
  total: number;
  totalNew: number;
  totalSent: number;
  totalError: number;
  totalFormContacted: number;
}> {
  const result = await query<{
    profession: string;
    total: string;
    new_count: string;
    sent: string;
    error: string;
    form_contacted: string;
    avg_score: string | null;
  }>(
    `SELECT
       profession,
       count(*)::text AS total,
       count(*) FILTER (WHERE status = 'new')::text AS new_count,
       count(*) FILTER (WHERE status = 'sent')::text AS sent,
       count(*) FILTER (WHERE status = 'error')::text AS error,
       count(*) FILTER (WHERE contacted_via = 'form')::text AS form_contacted,
       round(avg(icp_score) FILTER (WHERE icp_score IS NOT NULL))::text AS avg_score
     FROM god_prospects
     GROUP BY profession
     ORDER BY count(*) DESC`,
    [],
  );

  const byProfession = result.rows.map((r) => ({
    profession: r.profession,
    total: parseInt(r.total, 10),
    newCount: parseInt(r.new_count, 10),
    sent: parseInt(r.sent, 10),
    error: parseInt(r.error, 10),
    formContacted: parseInt(r.form_contacted, 10),
    avgScore: r.avg_score ? parseInt(r.avg_score, 10) : null,
  }));

  return {
    byProfession,
    total: byProfession.reduce((s, r) => s + r.total, 0),
    totalNew: byProfession.reduce((s, r) => s + r.newCount, 0),
    totalSent: byProfession.reduce((s, r) => s + r.sent, 0),
    totalError: byProfession.reduce((s, r) => s + r.error, 0),
    totalFormContacted: byProfession.reduce((s, r) => s + r.formContacted, 0),
  };
}

export async function findRecentProspects(input: {
  limit: number;
}): Promise<ProspectReportRow[]> {
  const result = await query<ProspectReportRow>(
    `SELECT id, profession, full_name AS "fullName", email,
            website, status, contacted_via AS "contactedVia",
            icp_score AS "icpScore", icp_reason AS "icpReason",
            sent_at AS "sentAt", created_at AS "createdAt"
     FROM god_prospects
     ORDER BY created_at DESC
     LIMIT $1`,
    [input.limit],
  );
  return result.rows;
}
