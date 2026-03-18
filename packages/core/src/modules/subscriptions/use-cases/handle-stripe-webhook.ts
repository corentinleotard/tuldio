import type Stripe from 'stripe';
import { getStripe } from '../../../lib/stripe/stripe-client.js';
import { logger } from '../../../lib/infra/logger.js';
import { updateSubscriptionStatus } from '../repository/update-subscription-status.js';
import { findTeamIdByCustomer } from '../repository/find-team-id-by-customer.js';

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

function extractCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

async function resolveTeamId(input: { customerId: string | null; metadata?: Stripe.Metadata | null }): Promise<string | null> {
  // Primary: look up team by stripe_customer_id in our DB
  if (input.customerId) {
    const teamId = await findTeamIdByCustomer({ stripeCustomerId: input.customerId });
    if (teamId) return teamId;
  }
  // Fallback: metadata (for checkout.session.completed where customer may not be stored yet)
  return input.metadata?.teamId ?? null;
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
      const customerId = extractCustomerId(session.customer);
      const teamId = await resolveTeamId({ customerId, metadata: session.metadata });
      if (!teamId) {
        logger.warn('checkout.session.completed: cannot resolve teamId', { customerId });
        return;
      }

      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items'],
        });
        const period = getSubscriptionPeriod(subscription);
        await updateSubscriptionStatus({
          teamId,
          subscriptionStatus: 'active',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          subscriptionPeriodStart: period.start,
          subscriptionPeriodEnd: period.end,
          cancelAtPeriodEnd: false,
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = extractCustomerId(subscription.customer);
      const teamId = await resolveTeamId({ customerId, metadata: subscription.metadata });
      if (!teamId) {
        logger.warn('customer.subscription.updated: cannot resolve teamId', { customerId });
        return;
      }

      const status = subscription.status === 'active' || subscription.status === 'trialing'
        ? 'active' as const
        : subscription.status === 'canceled' || subscription.status === 'unpaid'
          ? 'cancelled' as const
          : 'active' as const;

      const period = getSubscriptionPeriod(subscription);
      // Stripe uses cancel_at (timestamp) OR cancel_at_period_end (boolean) depending on API version
      const isCancelling = subscription.cancel_at_period_end || subscription.cancel_at !== null;
      await updateSubscriptionStatus({
        teamId,
        subscriptionStatus: status,
        subscriptionPeriodStart: period.start,
        subscriptionPeriodEnd: period.end,
        cancelAtPeriodEnd: isCancelling,
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = extractCustomerId(subscription.customer);
      const teamId = await resolveTeamId({ customerId, metadata: subscription.metadata });
      if (!teamId) {
        logger.warn('customer.subscription.deleted: cannot resolve teamId', { customerId });
        return;
      }

      await updateSubscriptionStatus({
        teamId,
        subscriptionStatus: 'cancelled',
        stripeSubscriptionId: null,
        cancelAtPeriodEnd: false,
        subscriptionPeriodStart: null,
        subscriptionPeriodEnd: null,
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = extractCustomerId(invoice.customer);
      logger.warn('Stripe payment failed', { customerId });
      break;
    }

    default:
      break;
  }
}
