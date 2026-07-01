import { createClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client — bound by Row Level Security.
 * Uses the anon key which can only access data the user is authorized for.
 * 
 * Decision: Using a singleton pattern for the browser client to avoid
 * creating multiple connections. Server-side code should use service.ts instead.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
