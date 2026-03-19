import { updateChannelLimit } from '../repository/update-channel-limit.js';

export async function updateChannelLimitsUc(input: {
  channel: string;
  dailyLimit: number;
}): Promise<void> {
  if (input.dailyLimit < 0) {
    throw new Error('La limite quotidienne doit être positive');
  }

  await updateChannelLimit({
    channel: input.channel,
    dailyLimit: input.dailyLimit,
  });
}
