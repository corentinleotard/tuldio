import type Stripe from 'stripe';
import { getStripe } from '../../../lib/stripe/stripe-client.js';
import { logger } from '../../../lib/infra/logger.js';
import { updateSubscriptionStatus } from '../repository/update-subscription-status.js';

function getSubscriptionPeriod(subscription: Stripe.Subscription): {
  start: Date | null;
  end: Date | null;
} {
  const item = subscription.items?.data?.[0];
  if (!item) return { start: null, end: null };
  return {
    start: new Date(item.current_period_start * 1000),
    end: new Date(item.current_period_end * 1000),
  };
}

export async function handleStripeWebhook(input: {
  body: Buffer;
  signature: string;
}): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }

  const event = stripe.webhooks.constructEvent(input.body, input.signature, webhookSecret);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const teamId = session.metadata?.teamId;
      if (!teamId) {
        logger.warn('checkout.session.completed without teamId metadata');
        return;
      }

      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

      if (subscriptionId) {
        // Ensure subscription carries teamId for future events (updated/deleted)
        await stripe.subscriptions.update(subscriptionId, {
          metadata: { teamId },
        });
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items'],
        });
        const period = getSubscriptionPeriod(subscription);
        await updateSubscriptionStatus({
          teamId,
          subscriptionStatus: 'active',
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
          stripeSubscriptionId: subscriptionId,
          subscriptionPeriodStart: period.start,
          subscriptionPeriodEnd: period.end,
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const teamId = subscription.metadata?.teamId;
      if (!teamId) {
        logger.warn('customer.subscription.updated without teamId metadata');
        return;
      }

      const status = subscription.status === 'active' || subscription.status === 'trialing'
        ? 'active' as const
        : subscription.status === 'canceled' || subscription.status === 'unpaid'
          ? 'cancelled' as const
          : 'active' as const;

      const period = getSubscriptionPeriod(subscription);
      await updateSubscriptionStatus({
        teamId,
        subscriptionStatus: status,
        subscriptionPeriodStart: period.start,
        subscriptionPeriodEnd: period.end,
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const teamId = subscription.metadata?.teamId;
      if (!teamId) {
        logger.warn('customer.subscription.deleted without teamId metadata');
        return;
      }

      await updateSubscriptionStatus({
        teamId,
        subscriptionStatus: 'cancelled',
        stripeSubscriptionId: null,
        subscriptionPeriodStart: null,
        subscriptionPeriodEnd: null,
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      logger.warn('Stripe payment failed', { customerId });
      break;
    }

    default:
      break;
  }
}
