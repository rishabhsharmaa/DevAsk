/**
 * Payment adapter configuration tests (fast, offline).
 *
 * Payments are optional on a deployment: importing these modules must never
 * throw for missing keys (that breaks `next build` page-data collection,
 * which imports every route). Missing keys fail only when a payment
 * operation is actually called — with a clear "not configured" message,
 * and no network call attempted first.
 *
 * Run: npm test
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createStripeCheckout,
  verifyStripeWebhook,
} from '../lib/payments/stripe';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyRazorpayWebhook,
} from '../lib/payments/razorpay';

const SAVED_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
});

afterEach(() => {
  process.env = { ...SAVED_ENV };
});

describe('payments without keys (unconfigured deployment)', () => {
  it('stripe checkout rejects with a not-configured error (no network call)', async () => {
    await assert.rejects(
      createStripeCheckout('user_123'),
      /not configured.*STRIPE_SECRET_KEY/
    );
  });

  it('stripe webhook verification throws a not-configured error', () => {
    assert.throws(
      () => verifyStripeWebhook('body', 'sig'),
      /not configured.*STRIPE_WEBHOOK_SECRET/
    );
  });

  it('razorpay order rejects with a not-configured error (no network call)', async () => {
    await assert.rejects(
      createRazorpayOrder('user_123'),
      /not configured.*RAZORPAY_KEY_ID/
    );
  });

  it('razorpay verifiers throw a not-configured error instead of mis-verifying', () => {
    assert.throws(
      () => verifyRazorpaySignature('order', 'payment', 'sig'),
      /not configured.*RAZORPAY_KEY_ID/
    );
    assert.throws(
      () => verifyRazorpayWebhook('body', 'sig'),
      /not configured.*RAZORPAY_WEBHOOK_SECRET/
    );
  });
});
