import Stripe from 'stripe';

/**
 * Stripe payment adapter.
 * Creates a hosted checkout session for Pro plan subscriptions.
 *
 * Price: $9/mo USD
 *
 * The client is created lazily (see getStripe): constructing it at module
 * level throws when STRIPE_SECRET_KEY is unset, which breaks `next build`
 * (page-data collection imports every route) on deployments that don't
 * configure payments. Missing keys now fail only when checkout is actually
 * used — with a clear message instead of a build error.
 */

let stripeInstance: Stripe | null = null;

/** Lazily create (and cache) the Stripe client. Throws clearly when unconfigured. */
function getStripe(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error(
        'Stripe is not configured (missing STRIPE_SECRET_KEY). Set it to enable checkout.'
      );
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: '2026-06-24.dahlia',
    });
  }
  return stripeInstance;
}

/**
 * Create a Stripe Checkout Session for Pro plan subscription.
 * Returns the checkout URL for client redirect.
 */
export async function createStripeCheckout(
  userId: string,
  customerEmail?: string
): Promise<{ checkout_url: string; customer_id: string }> {
  // Check if user already has a Stripe customer ID
  // If not, Stripe Checkout will create one automatically

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'DevAsk Pro',
            description: 'Unlimited repos, private repos, all LLM providers, persistent chat history',
          },
          unit_amount: 900, // $9.00 in cents
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      },
    ],
    // Store userId in metadata so the webhook can find the user
    metadata: {
      user_id: userId,
    },
    customer_email: customerEmail,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=cancelled`,
  });

  return {
    checkout_url: session.url!,
    customer_id: session.customer as string,
  };
}

/**
 * Verify a Stripe webhook signature.
 * Returns the parsed event or throws on invalid signature.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error(
      'Stripe is not configured (missing STRIPE_WEBHOOK_SECRET). Set it to verify webhooks.'
    );
  }
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    webhookSecret
  );
}
