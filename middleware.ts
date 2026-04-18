import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/middleware.ts";

const PROTECTED = /^\/admin(\/|$)/;
const PUBLIC = /^\/(login|auth|api\/airtable|_next|favicon\.ico)(\/|$)?/;

export async function middleware(request: NextRequest) {
  // Refresh the Supabase session cookie on every request.
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;
  if (!PROTECTED.test(pathname) || PUBLIC.test(pathname)) {
    return response;
  }

  // Quick cookie check — Supabase sets an "sb-<ref>-auth-token" cookie on login.
  // Any cookie starting with sb- means we have a session worth trusting to the
  // server component (which will call auth.getUser and redirect if stale).
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: [
    // Match everything except static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
