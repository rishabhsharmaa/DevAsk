import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client — BYPASSES Row Level Security.
 * 
 * ⚠️  ONLY use this in:
 *   - Webhook handlers (Stripe, Razorpay)
 *   - Server-side admin operations (indexing pipeline, plan updates)
 * 
 * NEVER expose this client to the browser or import it in client components.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase service environment variables. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    // Service role client doesn't need to persist sessions
    autoRefreshToken: false,
    persistSession: false,
  },
});
