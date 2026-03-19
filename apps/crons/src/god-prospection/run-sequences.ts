import { runSequenceStep, setupWhatsApp, consumeConnectRequest } from '@tuldio/core/god-prospection';
import { schedule } from '../lib/schedule.js';
import { logger } from '@tuldio/core/lib';

// Init WhatsApp at startup (reconnects from saved session if available)
setupWhatsApp().catch((err) => {
  logger.info('god-prospection.whatsapp-init-skip', {
    reason: err instanceof Error ? err.message : 'Not configured',
  });
});

// Poll for connect requests from the API (user clicked "Connecter" in the UI)
setInterval(() => {
  if (consumeConnectRequest()) {
    logger.info('god-prospection.whatsapp-connect-requested');
    setupWhatsApp().catch((err) => {
      logger.error('god-prospection.whatsapp-connect-failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    });
  }
}, 5000);

// Send emails + WhatsApp every hour
schedule({
  name: 'god-prospection:run-sequences',
  expression: '0 * * * *',
  fn: runSequenceStep,
});
