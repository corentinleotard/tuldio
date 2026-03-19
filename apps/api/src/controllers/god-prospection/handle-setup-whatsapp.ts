import type { Request, Response } from 'express';
import { requestWhatsAppConnect, readWhatsAppStatus } from '@tuldio/core/god-prospection';

export async function handleSetupWhatsApp(_req: Request, res: Response): Promise<void> {
  // Write a flag file so the crons process picks up the connect request
  requestWhatsAppConnect();

  // Poll the status file for up to 25 seconds (cron polls flag every 5s + Baileys init up to 10s)
  const startedAt = Date.now();
  let status = readWhatsAppStatus();

  for (let i = 0; i < 50; i++) {
    // Only trust status if it was updated after we requested the connect
    const isRecent = status.updatedAt && (Date.now() - new Date(status.updatedAt).getTime()) < 30000;
    if (isRecent && (status.connected || status.qrCode)) break;
    if (Date.now() - startedAt > 25000) break;
    await new Promise((r) => setTimeout(r, 500));
    status = readWhatsAppStatus();
  }

  res.json({ data: { qrCode: status.qrCode, connected: status.connected } });
}
