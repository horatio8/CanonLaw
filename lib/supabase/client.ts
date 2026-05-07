/**
 * Browser-side Supabase client.
 *
 * Uses the public anon key only — never import this in server code.
 * The PKCE code-verifier cookie is set directly in the browser,
 * which avoids the "code challenge does not match" error that happens
 * when signInWithOtp is called from a Server Action.
 */

import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "./env.ts";

export function createBrowserSupabaseClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
