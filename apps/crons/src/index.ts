import 'dotenv/config';
import { connectDb, logger } from '@tuldio/core/lib';

import './invoices/mark-overdue-invoices.js';
import './subscriptions/expire-trials.js';

connectDb().then(() => {
  logger.info('Cron scheduler starting');
});
