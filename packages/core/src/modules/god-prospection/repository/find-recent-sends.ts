import { query } from '../../../lib/database/db.js';

export interface RecentSendRow {
  id: string;
  prospectName: string;
  prospectEmail: string;
  channel: string;
  stepOrder: number;
  subject: string | null;
  body: string | null;
  sentAt: string;
}

export async function findRecentSends(input: {
  channel: string | null;
  limit: number;
}): Promise<RecentSendRow[]> {
  const params: Array<string | number> = [];
  let channelFilter = '';

  if (input.channel) {
    params.push(input.channel);
    channelFilter = `AND s.channel = $${params.length}`;
  }

  params.push(input.limit);

  const result = await query<RecentSendRow>(
    `SELECT s.id, p.full_name AS "prospectName", p.email AS "prospectEmail",
            s.channel, s.step_order AS "stepOrder",
            s.subject, s.body, s.sent_at AS "sentAt"
     FROM god_sequence_sends s
     JOIN god_prospects p ON p.id = s.prospect_id
     WHERE 1=1 ${channelFilter}
     ORDER BY s.sent_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return result.rows;
}
