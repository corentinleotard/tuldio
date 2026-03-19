import { runSequenceStep, setupWhatsApp } from '@tuldio/core/god-prospection';
import { schedule } from '../lib/schedule.js';
import { logger } from '@tuldio/core/lib';

// Init WhatsApp connection at startup (reconnects automatically, wires reply detection)
setupWhatsApp().catch((err) => {
  logger.info('god-prospection.whatsapp-init-skip', {
    reason: err instanceof Error ? err.message : 'Not configured',
  });
});

schedule({
  name: 'god-prospection:run-sequences',
  expression: '0 * * * *',
  fn: runSequenceStep,
});
