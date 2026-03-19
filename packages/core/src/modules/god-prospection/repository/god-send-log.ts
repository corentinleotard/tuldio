import { query } from '../../../lib/database/db.js';

export async function getDailyCount(input: {
  channel: string;
}): Promise<number> {
  const result = await query<{ count: number }>(
    `SELECT COALESCE(count, 0) AS count
     FROM god_send_log
     WHERE sent_date = CURRENT_DATE AND channel = $1`,
    [input.channel],
  );
  return result.rows[0]?.count ?? 0;
}

export async function incrementDailyCount(input: {
  channel: string;
  count: number;
}): Promise<void> {
  await query(
    `INSERT INTO god_send_log (id, sent_date, channel, count)
     VALUES (gen_random_uuid(), CURRENT_DATE, $1, $2)
     ON CONFLICT (sent_date, channel)
     DO UPDATE SET count = god_send_log.count + $2`,
    [input.channel, input.count],
  );
}
