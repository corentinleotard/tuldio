// env loaded via --env-file flag
import { connectDb } from '../packages/core/src/lib/index.js';
import { setupWhatsApp } from '../packages/core/src/modules/god-prospection/use-cases/setup-whatsapp.js';
import { sendWhatsAppMessage } from '../packages/core/src/modules/god-prospection/domain/whatsapp-client.js';
import { normalizePhoneToInternational } from '../packages/core/src/modules/god-prospection/domain/phone-utils.js';
import { buildMessageText } from '../packages/core/src/modules/god-prospection/domain/sequence-template.js';

async function main() {
  await connectDb();

  const status = await setupWhatsApp();
  console.log('WhatsApp:', status.connected ? 'connected' : 'not connected');
  if (!status.connected) {
    process.exit(1);
  }

  const text = buildMessageText({
    template: "Bonjour {{firstName}}, je vous ai envoye un email il y a quelques jours.\n\nJ'ai cree un outil pour les {{professionPlural}} : devis en 30 sec depuis le telephone, juste en envoyant un message.\n\nVotre espace est pret si ca vous interesse !",
    prospect: { firstName: '', fullName: 'Test', profession: 'Osteopathe' },
    inviteUrl: null,
  });

  const phone = normalizePhoneToInternational({ phone: '0631863377' });
  console.log('Sending to:', phone);
  console.log('Message:', text);

  await sendWhatsAppMessage({ phone, text });
  console.log('Sent!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
