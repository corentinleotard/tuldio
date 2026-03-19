import type { Request, Response } from 'express';
import { requestWhatsAppConnect, readWhatsAppStatus } from '@tuldio/core/god-prospection';

export async function handleSetupWhatsApp(_req: Request, res: Response): Promise<void> {
  // Write a flag file so the crons process picks up the connect request
  requestWhatsAppConnect();

  // Wait a bit for the crons to generate a QR (polls the status file)
  let status = readWhatsAppStatus();
  for (let i = 0; i < 30; i++) {
    if (status.connected || status.qrCode) break;
    await new Promise((r) => setTimeout(r, 500));
    status = readWhatsAppStatus();
  }

  res.json({ data: { qrCode: status.qrCode, connected: status.connected } });
}
