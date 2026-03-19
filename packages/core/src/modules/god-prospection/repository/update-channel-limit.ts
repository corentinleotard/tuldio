import { query } from '../../../lib/database/db.js';

export async function updateChannelLimit(input: {
  channel: string;
  dailyLimit: number;
}): Promise<void> {
  await query(
    `UPDATE god_channel_limits
     SET daily_limit = $1
     WHERE channel = $2`,
    [input.dailyLimit, input.channel],
  );
}
