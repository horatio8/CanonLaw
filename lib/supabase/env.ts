/**
 * Read-only env accessors with clear error messages. We never default these
 * in production — a misconfigured Vercel env should fail loudly.
 */

export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  return v;
}

export function supabaseAnonKey(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.");
  return v;
}

/** Service role key is ONLY read server-side — never exposed to the browser. */
export function supabaseServiceRoleKey(): string {
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return v;
}

/** The public base URL of this Next.js app (used for OAuth redirect URIs). */
export function appUrl(): string {
  const v = process.env.NEXT_PUBLIC_APP_URL;
  if (v) return v.replace(/\/$/, "");
  // Vercel provides VERCEL_URL without a protocol.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
