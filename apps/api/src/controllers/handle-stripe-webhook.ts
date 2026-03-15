import type { Request, Response } from 'express';
import { handleStripeWebhook } from '@tuldio/core/subscriptions';

export async function handleStripeWebhookController(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'];

  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ error: { code: 'MISSING_SIGNATURE', message: 'Missing stripe-signature header' } });
    return;
  }

  await handleStripeWebhook({
    body: req.body as Buffer,
    signature,
  });

  res.json({ received: true });
}
