import fs from 'node:fs';
import path from 'node:path';

const FILES_DIR = process.env.FILES_DIR || '/var/tuldio/files';
const STATUS_FILE = path.join(FILES_DIR, 'whatsapp-session', 'status.json');

export interface WhatsAppStatusFile {
  connected: boolean;
  phone: string | null;
  qrCode: string | null;
  updatedAt: string;
}

export function writeWhatsAppStatus(input: {
  connected: boolean;
  phone: string | null;
  qrCode: string | null;
}): void {
  const dir = path.dirname(STATUS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify({
    ...input,
    updatedAt: new Date().toISOString(),
  }));
}

export function readWhatsAppStatus(): WhatsAppStatusFile {
  try {
    const raw = fs.readFileSync(STATUS_FILE, 'utf8');
    return JSON.parse(raw) as WhatsAppStatusFile;
  } catch {
    return { connected: false, phone: null, qrCode: null, updatedAt: '' };
  }
}

/** Write a flag file to request the crons process to init WhatsApp */
export function requestWhatsAppConnect(): void {
  const flagFile = path.join(FILES_DIR, 'whatsapp-session', 'connect-requested');
  fs.mkdirSync(path.dirname(flagFile), { recursive: true });
  fs.writeFileSync(flagFile, new Date().toISOString());
}

export function consumeConnectRequest(): boolean {
  const flagFile = path.join(FILES_DIR, 'whatsapp-session', 'connect-requested');
  try {
    fs.unlinkSync(flagFile);
    return true;
  } catch {
    return false;
  }
}
