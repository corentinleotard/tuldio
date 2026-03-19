import { query } from '../../../lib/database/db.js';

export interface RecentSendRow {
  id: string;
  prospectName: string;
  prospectEmail: string;
  channel: string;
  stepOrder: number;
  sentAt: string;
}

export async function findRecentSends(input: {
  limit: number;
}): Promise<RecentSendRow[]> {
  const result = await query<RecentSendRow>(
    `SELECT s.id, p.full_name AS "prospectName", p.email AS "prospectEmail",
            s.channel, s.step_order AS "stepOrder", s.sent_at AS "sentAt"
     FROM god_sequence_sends s
     JOIN god_prospects p ON p.id = s.prospect_id
     ORDER BY s.sent_at DESC
     LIMIT $1`,
    [input.limit],
  );
  return result.rows;
}
