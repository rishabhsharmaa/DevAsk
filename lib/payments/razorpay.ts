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

const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';

/**
 * Read the Razorpay API keys at call time (never at import, so unconfigured
 * deployments still build and boot). Throws clearly when keys are missing
 * instead of failing later with a cryptic API 401.
 */
function requireKeys(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      'Razorpay is not configured (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET). ' +
        'Set them to enable checkout.'
    );
  }
  return { keyId, keySecret };
}

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
  const { keyId, keySecret } = requireKeys();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

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
    razorpay_key: requireKeys().keyId,
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
  const { keySecret } = requireKeys();
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
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
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error(
      'Razorpay is not configured (missing RAZORPAY_WEBHOOK_SECRET). Set it to verify webhooks.'
    );
  }
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}
