import type { Request, Response } from 'express';
import { setupWhatsApp } from '@tuldio/core/god-prospection';

export async function handleSetupWhatsApp(_req: Request, res: Response): Promise<void> {
  const result = await setupWhatsApp();
  res.json({ data: result });
}
