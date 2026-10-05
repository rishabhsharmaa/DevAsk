import { createClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client — bound by Row Level Security.
 *
 * Singleton (one GoTrueClient per browser context). Every request carries
 * the user's Clerk session JWT, which Supabase validates against the Clerk
 * JWKS configured under Authentication → Third-Party Auth; RLS policies
 * match `auth.jwt() ->> 'sub'` against stored Clerk user IDs.
 *
 * Client components register Clerk's getToken once on mount (before any
 * query fires); the getter is read lazily per request, so it never goes
 * stale:
 *
 *   const { getToken } = useAuth();
 *   useEffect(() => { setBrowserTokenGetter(getToken); }, [getToken]);
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

let tokenGetter: () => Promise<string | null> = async () => null;

export function setBrowserTokenGetter(
  getToken: () => Promise<string | null>
): void {
  tokenGetter = getToken;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
      // Signed-out callers fall back to the anon key (public reads only).
      const token = await tokenGetter().catch(() => null);
      const headers = new Headers(init.headers);
      headers.set('apikey', supabaseAnonKey);
      headers.set('Authorization', `Bearer ${token ?? supabaseAnonKey}`);
      return fetch(input, { ...init, headers });
    },
  },
});
