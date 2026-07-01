import Stripe from 'stripe';

/**
 * Stripe payment adapter.
 * Creates a hosted checkout session for Pro plan subscriptions.
 * 
 * Price: $9/mo USD
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
});

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

  const session = await stripe.checkout.sessions.create({
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
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

export { stripe };
