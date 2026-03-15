import { getStripe } from '../../../lib/stripe/stripe-client.js';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTeamSubscription } from '../repository/find-team-subscription.js';

export async function createCustomerPortal(input: {
  teamId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const sub = await findTeamSubscription({ teamId: input.teamId });

  if (!sub?.stripe_customer_id) {
    throw new HandledError(errorCodes.checkoutFailed);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: input.returnUrl,
  });

  return { url: session.url };
}
