/**
 * Airtable OAuth 2.0 + PKCE helpers.
 *
 * Airtable's OAuth reference: https://airtable.com/developers/web/api/oauth-reference
 *
 * Flow:
 *   1. Generate code_verifier + code_challenge (S256).
 *   2. Redirect user to authorize URL with client_id, redirect_uri, scope, state, code_challenge.
 *   3. Airtable redirects back to redirect_uri with ?code=... &state=....
 *   4. POST to /oauth2/v1/token with code + code_verifier to exchange for access/refresh tokens.
 *   5. Refresh tokens via the same endpoint with grant_type=refresh_token before expiry.
 */

import { createHash, randomBytes } from "node:crypto";

export const AIRTABLE_AUTHORIZE_URL = "https://airtable.com/oauth2/v1/authorize";
export const AIRTABLE_TOKEN_URL = "https://airtable.com/oauth2/v1/token";

/** Minimum scopes for the super-admin flow. */
export const REQUIRED_SCOPES = [
  "data.records:read",
  "data.records:write",
  "schema.bases:read",
  "schema.bases:write",
] as const;

export interface OAuthClientConfig {
  clientId: string;
  /** Optional for public clients with PKCE only; required for confidential clients. */
  clientSecret?: string;
  redirectUri: string;
  scopes?: ReadonlyArray<string>;
}

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

export interface AuthorizeRequest extends PKCEPair {
  state: string;
  authorizeUrl: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number; // seconds
  scope: string;
  refresh_expires_in?: number;
}

/** Base64url without padding, per RFC 7636 §4.1. */
function base64url(bytes: Buffer): string {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePKCE(): PKCEPair {
  // 43–128 chars per RFC 7636; 32 random bytes → 43-char b64url.
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return base64url(randomBytes(24));
}

export function buildAuthorizeRequest(cfg: OAuthClientConfig): AuthorizeRequest {
  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    scope: (cfg.scopes ?? REQUIRED_SCOPES).join(" "),
  });
  return {
    codeVerifier,
    codeChallenge,
    state,
    authorizeUrl: `${AIRTABLE_AUTHORIZE_URL}?${params.toString()}`,
  };
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export async function exchangeCodeForToken(
  cfg: OAuthClientConfig,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    code_verifier: codeVerifier,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (cfg.clientSecret) {
    headers.Authorization = basicAuthHeader(cfg.clientId, cfg.clientSecret);
  }
  const res = await fetch(AIRTABLE_TOKEN_URL, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  cfg: OAuthClientConfig,
  refreshToken: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: cfg.clientId,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (cfg.clientSecret) {
    headers.Authorization = basicAuthHeader(cfg.clientId, cfg.clientSecret);
  }
  const res = await fetch(AIRTABLE_TOKEN_URL, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Refresh failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Load OAuth client config from environment; throws if required vars missing. */
export function loadClientConfigFromEnv(): OAuthClientConfig {
  const clientId = process.env.AIRTABLE_CLIENT_ID;
  const redirectUri = process.env.AIRTABLE_REDIRECT_URI ?? "http://localhost:3000/auth/callback";
  if (!clientId) {
    throw new Error(
      "AIRTABLE_CLIENT_ID is not set. Create an OAuth integration at https://airtable.com/create/oauth and copy the Client ID.",
    );
  }
  const cfg: OAuthClientConfig = { clientId, redirectUri };
  if (process.env.AIRTABLE_CLIENT_SECRET) {
    cfg.clientSecret = process.env.AIRTABLE_CLIENT_SECRET;
  }
  return cfg;
}
