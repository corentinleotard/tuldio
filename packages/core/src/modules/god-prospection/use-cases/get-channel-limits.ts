import { findChannelLimits } from '../repository/find-channel-limits.js';
import { getDailyCount } from '../repository/god-send-log.js';

export interface ChannelLimitView {
  channel: string;
  dailyLimit: number;
  dailyUsed: number;
}

export async function getChannelLimits(): Promise<ChannelLimitView[]> {
  const limits = await findChannelLimits();

  const views: ChannelLimitView[] = [];
  for (const limit of limits) {
    const dailyUsed = await getDailyCount({ channel: limit.channel });
    views.push({
      channel: limit.channel,
      dailyLimit: limit.dailyLimit,
      dailyUsed,
    });
  }

  return views;
}
