import { query } from '../../../lib/database/db.js';

export async function getDailyCount(): Promise<number> {
  const result = await query<{ count: number }>(
    `SELECT COALESCE(count, 0) AS count
     FROM god_send_log
     WHERE sent_date = CURRENT_DATE`,
    [],
  );
  return result.rows[0]?.count ?? 0;
}

export async function incrementDailyCount(input: {
  count: number;
}): Promise<void> {
  await query(
    `INSERT INTO god_send_log (id, sent_date, count)
     VALUES (gen_random_uuid(), CURRENT_DATE, $1)
     ON CONFLICT (sent_date)
     DO UPDATE SET count = god_send_log.count + $1`,
    [input.count],
  );
}
