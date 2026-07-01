import crypto from 'crypto';

/**
 * Razorpay payment adapter.
 * Creates an order for Pro plan subscriptions (India, INR).
 * 
 * Price: ₹499/mo INR
 * 
 * Decision: Using raw Razorpay REST API instead of the `razorpay` npm package
 * for the order creation, since we only need two operations (create order +
 * verify signature). The npm package adds unnecessary bundle size.
 */

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;
const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';

/**
 * Create a Razorpay order for Pro plan subscription.
 * Returns order details for the client-side popup checkout.
 */
export async function createRazorpayOrder(
  userId: string
): Promise<{
  order_id: string;
  razorpay_key: string;
  amount: number;
  currency: string;
}> {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  const response = await fetch(`${RAZORPAY_BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: 49900,        // ₹499 in paise
      currency: 'INR',
      receipt: `devask_pro_${userId}_${Date.now()}`,
      notes: {
        user_id: userId,
        plan: 'pro',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Razorpay order creation failed: ${error}`);
  }

  const order = await response.json();

  return {
    order_id: order.id,
    razorpay_key: RAZORPAY_KEY_ID,
    amount: 49900,
    currency: 'INR',
  };
}

/**
 * Verify Razorpay payment signature (immediate verification for fast UI feedback).
 * 
 * Per Razorpay docs: generated_signature = HMAC_SHA256(orderId + "|" + paymentId, secret)
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

/**
 * Verify Razorpay webhook signature.
 * Per Razorpay docs: signature = HMAC_SHA256(rawBody, webhookSecret)
 */
export function verifyRazorpayWebhook(
  rawBody: string,
  signature: string
): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}
