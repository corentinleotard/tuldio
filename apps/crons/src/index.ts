import 'dotenv/config';
import { connectDb, logger } from '@tuldio/core/lib';

import './invoices/mark-overdue-invoices.js';
import './subscriptions/expire-trials.js';

connectDb().then(async () => {
  logger.info('Cron scheduler starting');

  // God-prospection sequence crons: production only (sends real emails/WhatsApp)
  if (process.env.NODE_ENV === 'production') {
    await import('./god-prospection/run-sequences.js');
    await import('./god-prospection/check-prospect-replies.js');
  } else {
    logger.info('Skipping god-prospection crons (NODE_ENV !== production)');
  }
});
