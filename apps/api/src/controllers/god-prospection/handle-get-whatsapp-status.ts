import type { Request, Response } from 'express';
import { readWhatsAppStatus } from '@tuldio/core/god-prospection';

export async function handleGetWhatsAppStatus(_req: Request, res: Response): Promise<void> {
  const status = readWhatsAppStatus();
  res.json({ data: { connected: status.connected, phone: status.phone } });
}
