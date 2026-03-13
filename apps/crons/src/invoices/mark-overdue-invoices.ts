import { schedule } from '../lib/schedule.js';
import { markOverdueInvoices } from '@tuldio/core/invoices';
import { logger } from '@tuldio/core/lib';

schedule({
  name: 'mark-overdue-invoices',
  expression: '0 8 * * *', // daily at 08:00
  fn: async () => {
    console.log('coucou');
    const count = await markOverdueInvoices();
    if (count > 0) {
      logger.info(`[cron:mark-overdue-invoices] Marked ${count} invoice(s) as overdue`);
    }
  },
});
