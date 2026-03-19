import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import type { Boom } from '@hapi/boom';
import { logger } from '../../../lib/infra/logger.js';

const FILES_DIR = process.env.FILES_DIR || '/var/tuldio/files';
const SESSION_DIR = `${FILES_DIR}/whatsapp-session`;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 5000;

let sock: WASocket | null = null;
let connected = false;
let currentPhone: string | null = null;
let latestQr: string | null = null;
let messageHandler: ((input: { from: string; text: string }) => void) | null = null;
let reconnectAttempts = 0;
let initializing = false;

export async function initWhatsApp(): Promise<{ qrCode: string | null; connected: boolean }> {
  if (sock && connected) {
    return { qrCode: null, connected: true };
  }

  // Prevent concurrent init calls
  if (initializing) {
    return { qrCode: latestQr, connected: false };
  }
  initializing = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });

    latestQr = null;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        latestQr = qr;
        logger.info('god-prospection.whatsapp-qr', { message: 'QR code available' });
      }

      if (connection === 'open') {
        connected = true;
        latestQr = null;
        reconnectAttempts = 0;
        currentPhone = sock?.user?.id?.split(':')[0] ?? null;
        logger.info('god-prospection.whatsapp-connected', { phone: currentPhone });
      }

      if (connection === 'close') {
        connected = false;
        currentPhone = null;
        initializing = false;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

        if (statusCode !== DisconnectReason.loggedOut && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts - 1);
          logger.info('god-prospection.whatsapp-reconnecting', {
            statusCode,
            attempt: reconnectAttempts,
            delayMs: delay,
          });
          setTimeout(() => {
            initWhatsApp().catch((err) => {
              logger.error('god-prospection.whatsapp-reconnect-failed', {
                error: err instanceof Error ? err.message : 'Unknown error',
              });
            });
          }, delay);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          logger.error('god-prospection.whatsapp-max-retries', { attempts: reconnectAttempts });
          sock = null;
        } else {
          logger.info('god-prospection.whatsapp-logged-out');
          sock = null;
        }
      }
    });

    sock.ev.on('messages.upsert', ({ messages: msgs }) => {
      if (!messageHandler) return;
      for (const msg of msgs) {
        if (msg.key.fromMe) continue;
        const from = msg.key.remoteJid?.replace('@s.whatsapp.net', '') ?? '';
        const text = msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || '';
        if (from && text) {
          messageHandler({ from, text });
        }
      }
    });

    // Poll for QR or connection (up to 10 seconds)
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (latestQr || connected) break;
    }

    return { qrCode: latestQr, connected };
  } finally {
    initializing = false;
  }
}

export async function sendWhatsAppMessage(input: { phone: string; text: string }): Promise<void> {
  if (!sock || !connected) {
    throw new Error('WhatsApp non connecte');
  }

  const jid = input.phone.replace('+', '') + '@s.whatsapp.net';
  await sock.sendMessage(jid, { text: input.text });
}

export function getWhatsAppStatus(): { connected: boolean; phone: string | null } {
  return { connected, phone: currentPhone };
}

export function onWhatsAppMessage(handler: (input: { from: string; text: string }) => void): void {
  messageHandler = handler;
}

export async function disconnectWhatsApp(): Promise<void> {
  if (sock) {
    await sock.logout();
    sock = null;
    connected = false;
    currentPhone = null;
    latestQr = null;
    reconnectAttempts = 0;
  }
}
