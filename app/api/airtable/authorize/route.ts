import { NextResponse, type NextRequest } from "next/server";
import { buildAuthorizeRequest } from "../../../../src/airtable/oauth.ts";
import { oauthConfig } from "../../../../lib/airtable/service.ts";
import { requireSuperAdmin } from "../../../../lib/auth.ts";
import { storeOAuthState } from "../../../../lib/airtable/store.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Kicks off Airtable OAuth. Stores the PKCE verifier + state in Supabase,
// keyed to (state, current user, current org). The callback route validates.
export async function GET(_request: NextRequest) {
  const { org } = await requireSuperAdmin();
  const user = await (await import("../../../../lib/auth.ts")).requireUser();
  const auth = buildAuthorizeRequest(oauthConfig());
  await storeOAuthState(auth.state, auth.codeVerifier, org.id, user.id);
  return NextResponse.redirect(auth.authorizeUrl);
}
