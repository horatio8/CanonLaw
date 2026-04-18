/**
 * Service-role Supabase client — bypasses RLS. Use ONLY on the server for
 * trusted operations (token encryption/decryption via the pgsodium-backed
 * RPCs, cleanup jobs, etc.). Never import from a client component.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "./env.ts";

let _client: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
