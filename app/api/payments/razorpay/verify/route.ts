import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { verifyRazorpaySignature } from '@/lib/payments/razorpay';
import { supabaseAdmin } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.' },
        { status: 400 }
      );
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid payment signature.' }, { status: 400 });
    }

    // Update user plan immediately for fast UI feedback
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        plan: 'pro',
        payment_provider: 'razorpay',
        plan_expires_at: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(), // 32 days
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Razorpay signature verification error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
