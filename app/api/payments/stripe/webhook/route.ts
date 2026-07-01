import { NextRequest, NextResponse } from 'next/server';
import { verifyStripeWebhook } from '@/lib/payments/stripe';
import { supabaseAdmin } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    const event = verifyStripeWebhook(rawBody, signature);

    console.log(`Received Stripe webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.user_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!userId) {
          console.error('Stripe Checkout Session missing user_id in metadata');
          return NextResponse.json({ error: 'Missing user_id in metadata' }, { status: 400 });
        }

        // Update user record to Pro plan
        const { error } = await supabaseAdmin
          .from('users')
          .update({
            plan: 'pro',
            payment_provider: 'stripe',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_expires_at: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(), // 32 days from now
          })
          .eq('id', userId);

        if (error) {
          throw error;
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
          // Extend subscription expiration date
          const { error } = await supabaseAdmin
            .from('users')
            .update({
              plan: 'pro',
              plan_expires_at: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq('stripe_subscription_id', subscriptionId);

          if (error) {
            throw error;
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;

        // Downgrade user to free plan
        const { error } = await supabaseAdmin
          .from('users')
          .update({
            plan: 'free',
            stripe_subscription_id: null,
            plan_expires_at: null,
          })
          .eq('stripe_subscription_id', subscriptionId);

        if (error) {
          throw error;
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    // Return 500 on internal failure so Stripe retries
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 500 });
  }
}
