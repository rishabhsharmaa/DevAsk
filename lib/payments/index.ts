import { createStripeCheckout } from './stripe';
import { createRazorpayOrder } from './razorpay';
import type { PaymentProvider, CheckoutResponse } from '@/types';

/**
 * Payment routing — auto-selects provider by IP geolocation.
 * India → Razorpay (₹499/mo INR)
 * Everywhere else → Stripe ($9/mo USD)
 * 
 * NEVER shown as a user choice — routing is fully automatic.
 */

/**
 * Detect country from IP address using ipapi.co.
 * Falls back to 'US' on any error (defaults to Stripe).
 */
async function detectCountry(ip: string | null): Promise<string> {
  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    // Local development — default to Stripe
    return 'US';
  }

  try {
    const response = await fetch(`https://ipapi.co/${ip}/country/`, {
      signal: AbortSignal.timeout(3000), // 3s timeout
    });

    if (!response.ok) return 'US';

    const country = await response.text();
    return country.trim() || 'US';
  } catch {
    // Network error or timeout — default to Stripe
    return 'US';
  }
}

/**
 * Determine which payment provider to use based on country.
 */
function getProviderForCountry(country: string): PaymentProvider {
  return country === 'IN' ? 'razorpay' : 'stripe';
}

/**
 * Create a checkout session, auto-routing by IP geolocation.
 * 
 * @param userId - Clerk user ID
 * @param ip - Client IP address (from request headers)
 * @param email - Optional user email for Stripe pre-fill
 */
export async function createCheckoutSession(
  userId: string,
  ip: string | null,
  email?: string
): Promise<CheckoutResponse> {
  const country = await detectCountry(ip);
  const provider = getProviderForCountry(country);

  if (provider === 'razorpay') {
    const order = await createRazorpayOrder(userId);
    return {
      provider: 'razorpay',
      order_id: order.order_id,
      razorpay_key: order.razorpay_key,
      amount: order.amount,
      currency: order.currency,
    };
  }

  // Default: Stripe
  const { checkout_url } = await createStripeCheckout(userId, email);
  return {
    provider: 'stripe',
    checkout_url,
  };
}

/**
 * Extract client IP from various headers.
 * Vercel sets x-forwarded-for; other proxies may use x-real-ip.
 */
export function getClientIP(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    null
  );
}
