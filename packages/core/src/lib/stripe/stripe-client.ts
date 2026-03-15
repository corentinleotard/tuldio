import Stripe from 'stripe';

let instance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!instance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    instance = new Stripe(key, { apiVersion: '2026-02-25.clover' });
  }
  return instance;
}
