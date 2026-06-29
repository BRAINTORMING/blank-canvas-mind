// External Supabase client for the user's own instance (NOT Lovable Cloud).
//
// SECURITY: This client must be initialized with the **anon** (publishable) key only.
// Never embed a service_role key in client code — it bypasses RLS for every visitor.
// Configure via VITE_EXTERNAL_SUPABASE_URL and VITE_EXTERNAL_SUPABASE_ANON_KEY.
// If service_role privileges are required, move the operation to a server-side
// Edge Function where the key is held in a server-only environment variable.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const EXTERNAL_URL = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || '';
const EXTERNAL_ANON = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

if (EXTERNAL_ANON) {
  client = createClient(EXTERNAL_URL, EXTERNAL_ANON, {
    auth: { persistSession: true, storage: localStorage, autoRefreshToken: true },
  });
} else {
  console.warn(
    '[externalSupabase] Missing VITE_EXTERNAL_SUPABASE_ANON_KEY. ' +
    'Set the external Supabase ANON key (never the service_role key) in your environment.'
  );
}

export const externalSupabase = client;
export const EXTERNAL_SUPABASE_URL = EXTERNAL_URL;
export const EXTERNAL_SUPABASE_ANON = EXTERNAL_ANON;
