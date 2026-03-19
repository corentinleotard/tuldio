import { initWhatsApp, onWhatsAppMessage } from '../domain/whatsapp-client.js';
import { markProspectReplied } from '../repository/mark-prospect-replied.js';
import { insertReceivedMessage } from '../repository/insert-received-message.js';
import { logger } from '../../../lib/infra/logger.js';

let handlerRegistered = false;

export async function setupWhatsApp(): Promise<{ qrCode: string | null; connected: boolean }> {
  if (!handlerRegistered) {
    onWhatsAppMessage(({ from, text }) => {
      const phone = '+' + from;

      insertReceivedMessage({
        channel: 'whatsapp',
        sender: phone,
        senderName: null,
        subject: null,
        body: text,
      }).catch((err) => {
        logger.error('god-prospection.whatsapp-store-error', {
          from,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });

      markProspectReplied({ phone }).catch((err) => {
        logger.error('god-prospection.whatsapp-reply-error', {
          from,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });
    });
    handlerRegistered = true;
  }

  return initWhatsApp();
}
