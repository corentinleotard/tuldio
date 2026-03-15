import { schedule } from '../lib/schedule.js';
import { expireTrials } from '@tuldio/core/subscriptions';
import { logger } from '@tuldio/core/lib';

schedule({
  name: 'expire-trials',
  expression: '5 0 * * *', // daily at 00:05
  fn: async () => {
    const count = await expireTrials();
    if (count > 0) {
      logger.info(`[cron:expire-trials] Expired ${count} trial(s)`);
    }
  },
});
