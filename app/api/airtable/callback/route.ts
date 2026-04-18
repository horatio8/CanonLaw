import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForToken } from "../../../../src/airtable/oauth.ts";
import { AirtableClient } from "../../../../src/airtable/client.ts";
import { oauthConfig } from "../../../../lib/airtable/service.ts";
import { requireUser } from "../../../../lib/auth.ts";
import { consumeOAuthState, saveTokens } from "../../../../lib/airtable/store.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorUrl(origin: string, msg: string): URL {
  return new URL(`/admin?error=${encodeURIComponent(msg)}`, origin);
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(
      errorUrl(url.origin, `Airtable returned error: ${err}`),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(errorUrl(url.origin, "Missing code or state."));
  }

  const user = await requireUser();
  const stash = await consumeOAuthState(state);
  if (!stash) {
    return NextResponse.redirect(errorUrl(url.origin, "Session expired; try again."));
  }
  if (stash.userId !== user.id) {
    return NextResponse.redirect(
      errorUrl(url.origin, "User mismatch on OAuth return."),
    );
  }

  try {
    const token = await exchangeCodeForToken(oauthConfig(), code, stash.codeVerifier);
    // Capture Airtable user identity for the UI.
    let airtableUserId: string | null = null;
    let airtableUserEmail: string | null = null;
    try {
      const who = await new AirtableClient(token.access_token).whoAmI();
      airtableUserId = who.id ?? null;
      airtableUserEmail = who.email ?? null;
    } catch {
      // whoami is optional; proceed without it.
    }
    await saveTokens({
      orgId: stash.orgId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      scope: token.scope,
      airtableUserId,
      airtableUserEmail,
    });
    return NextResponse.redirect(new URL("/admin/bases", url.origin));
  } catch (e) {
    return NextResponse.redirect(errorUrl(url.origin, (e as Error).message));
  }
}
