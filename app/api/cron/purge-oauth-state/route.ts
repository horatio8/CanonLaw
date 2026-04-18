import { NextResponse, type NextRequest } from "next/server";
import { purgeStaleOAuthState } from "../../../../lib/airtable/store.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel Cron calls this hourly (see vercel.json). Authenticates via the
// VERCEL_CRON_SECRET header if set; otherwise the route is world-callable —
// set it in production.
export async function GET(request: NextRequest) {
  const secret = process.env.VERCEL_CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const purged = await purgeStaleOAuthState();
  return NextResponse.json({ purged });
}
