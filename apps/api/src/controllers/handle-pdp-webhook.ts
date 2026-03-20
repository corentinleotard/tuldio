import type { Request, Response } from 'express';
import { handlePdpStatusUpdate } from '@tuldio/core/invoices';

// TODO: Implement signature verification when PDP partner is chosen
// Each PDP has its own webhook signature scheme (HMAC, JWT, etc.)
// For now, this endpoint accepts all requests -- it will be secured before production use

export async function handlePdpWebhook(req: Request, res: Response): Promise<void> {
  // Webhook routes use express.raw() for Stripe compatibility -- parse JSON from raw buffer
  let body: Record<string, unknown>;
  try {
    body = typeof req.body === 'string' || Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString())
      : req.body;
  } catch {
    res.status(400).json({ error: { code: 'invalid_json', message: 'Malformed JSON body' } });
    return;
  }
  const { pdpId, status } = body as { pdpId?: string; status?: string };

  if (!pdpId || !status) {
    res.status(400).json({ error: { code: 'invalid_webhook_payload', message: 'Missing pdpId or status' } });
    return;
  }

  await handlePdpStatusUpdate({ pdpId, status });
  res.json({ data: { received: true } });
}
