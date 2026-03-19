import { getWhatsAppStatus as getStatus } from '../domain/whatsapp-client.js';

export function getWhatsAppStatusUc(): { connected: boolean; phone: string | null } {
  return getStatus();
}
