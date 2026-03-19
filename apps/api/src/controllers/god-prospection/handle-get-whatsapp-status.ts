import type { Request, Response } from 'express';
import { getWhatsAppStatusUc } from '@tuldio/core/god-prospection';

export async function handleGetWhatsAppStatus(_req: Request, res: Response): Promise<void> {
  const status = getWhatsAppStatusUc();
  res.json({ data: status });
}
