import { query } from '../../../lib/database/db.js';

const WATERMARK_KEY = 'reply_check_last_uid';

export async function getReplyWatermark(): Promise<number> {
  const result = await query<{ value: string }>(
    `SELECT value FROM god_prospection_settings WHERE key = $1`,
    [WATERMARK_KEY],
  );
  return result.rows[0] ? parseInt(result.rows[0].value, 10) : 0;
}

export async function setReplyWatermark(input: { uid: number }): Promise<void> {
  await query(
    `INSERT INTO god_prospection_settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [WATERMARK_KEY, String(input.uid)],
  );
}
