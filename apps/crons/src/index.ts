import 'dotenv/config';
import { connectDb, logger } from '@tuldio/core/lib';

// Import cron jobs here as they're created:
// import './jobs/example.js';

connectDb().then(() => {
  logger.info('Cron scheduler starting');
});
