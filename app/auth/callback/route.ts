import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Handles the redirect from a Supabase magic-link email. Exchanges the `code`
// query param for a session cookie, then forwards the user to `next` (default
// /admin). Supabase SSR helper wraps the PKCE exchange.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/admin";
  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("Missing auth code.")}`, url.origin),
    );
  }
  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
