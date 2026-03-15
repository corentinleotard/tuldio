import { getStripe } from '../../../lib/stripe/stripe-client.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamSubscription } from '../repository/find-team-subscription.js';
import { updateSubscriptionStatus } from '../repository/update-subscription-status.js';

export async function createCheckoutSession(input: {
  teamId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error('STRIPE_PRICE_ID is not set');

  const sub = await findTeamSubscription({ teamId: input.teamId });

  if (!sub) {
    throw new HandledError(errorCodes.checkoutFailed);
  }

  let customerId = sub.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: input.email,
      metadata: { teamId: input.teamId },
    });
    customerId = customer.id;
    await updateSubscriptionStatus({
      teamId: input.teamId,
      subscriptionStatus: sub.subscription_status,
      stripeCustomerId: customerId,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_update: { name: 'auto', address: 'auto' },
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { teamId: input.teamId },
      subscription_data: { metadata: { teamId: input.teamId } },
    });

    if (!session.url) {
      throw new HandledError(errorCodes.checkoutFailed);
    }

    return { url: session.url };
  } catch (err) {
    if (err instanceof HandledError) throw err;
    throw new HandledError(errorCodes.checkoutFailed);
  }
}
