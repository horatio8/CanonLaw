/**
 * Thin server-side service layer over `lib/airtable/store.ts`.
 *
 * Responsibilities:
 *   - Given an orgId, return a valid AirtableClient (refreshing the token if
 *     <60s from expiry).
 *   - Load OAuth client config from environment variables set in Vercel.
 */

import "server-only";
import { AirtableClient } from "../../src/airtable/client.ts";
import {
  loadClientConfigFromEnv,
  refreshAccessToken,
  type OAuthClientConfig,
} from "../../src/airtable/oauth.ts";
import { loadIntegration, saveTokens } from "./store.ts";
import { appUrl } from "../supabase/env.ts";

/**
 * Resolve the OAuth config — overriding the redirect URI to the deployed
 * app's /api/airtable/callback. This avoids drift between the local dev
 * server and the Vercel deployment.
 */
export function oauthConfig(): OAuthClientConfig {
  const base = loadClientConfigFromEnv();
  return { ...base, redirectUri: `${appUrl()}/api/airtable/callback` };
}

export async function getAccessTokenForOrg(orgId: string): Promise<string> {
  const state = await loadIntegration(orgId);
  if (!state) throw new Error("Airtable is not connected for this organization.");
  if (Date.now() < state.expiresAt - 60_000) return state.accessToken;
  const fresh = await refreshAccessToken(oauthConfig(), state.refreshToken);
  await saveTokens({
    orgId,
    accessToken: fresh.access_token,
    refreshToken: fresh.refresh_token,
    expiresAt: Date.now() + fresh.expires_in * 1000,
    scope: fresh.scope,
    airtableUserId: state.airtableUserId ?? null,
    airtableUserEmail: state.airtableUserEmail ?? null,
  });
  return fresh.access_token;
}

export async function clientForOrg(orgId: string): Promise<AirtableClient> {
  return new AirtableClient(await getAccessTokenForOrg(orgId));
}
