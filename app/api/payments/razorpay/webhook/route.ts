import { NextRequest, NextResponse } from 'next/server';
import { verifyRazorpayWebhook } from '@/lib/payments/razorpay';
import { supabaseAdmin } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
    }

    const isValid = verifyRazorpayWebhook(rawBody, signature);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    console.log(`Received Razorpay webhook event: ${payload.event}`);

    if (payload.event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      const userId = payment.notes?.user_id;

      if (!userId) {
        console.error('Razorpay payment captured missing user_id in notes');
        return NextResponse.json({ error: 'Missing user_id in notes' }, { status: 400 });
      }

      // Update user plan to Pro
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          plan: 'pro',
          payment_provider: 'razorpay',
          plan_expires_at: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Razorpay webhook error:', error);
    // Return 500 so Razorpay retries the webhook
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 500 });
  }
}
