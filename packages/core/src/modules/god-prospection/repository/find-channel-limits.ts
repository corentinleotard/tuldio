import { query } from '../../../lib/database/db.js';

export interface GodChannelLimitRow {
  id: string;
  channel: string;
  dailyLimit: number;
}

export async function findChannelLimits(): Promise<GodChannelLimitRow[]> {
  const result = await query<GodChannelLimitRow>(
    `SELECT id, channel, daily_limit AS "dailyLimit"
     FROM god_channel_limits
     ORDER BY channel ASC`,
    [],
  );
  return result.rows;
}
