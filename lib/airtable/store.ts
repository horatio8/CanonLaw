/**
 * Supabase-backed Airtable integration store.
 *
 * One row per org in public.airtable_integrations. Tokens encrypted at rest
 * via the pgsodium-backed RPCs (encrypt_token / decrypt_token); the
 * service-role client invokes those on the app's behalf.
 *
 * Shape:
 *   - `load(orgId)` — returns the decrypted tokens + selected base, or null.
 *   - `saveTokens(orgId, ...)` — upserts a fresh OAuth token pair.
 *   - `saveBase(orgId, ...)` — updates only the selected base fields.
 *   - `clear(orgId)` — deletes the row.
 */

import "server-only";
import { randomBytes } from "node:crypto";
import { adminClient } from "../supabase/admin.ts";
import type { AirtableIntegrationRow } from "../supabase/types.ts";

export interface IntegrationState {
  orgId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
  scope: string;
  airtableUserId: string | null;
  airtableUserEmail: string | null;
  selectedBase: {
    baseId: string;
    baseName: string;
    tableIds: Record<string, string>;
    lastProvisionedAt: number | null;
  } | null;
  connectedAt: number;
  updatedAt: number;
}

const NONCE_LEN = 24; // pgsodium crypto_aead_det supports 24-byte nonces.

/** Encrypt via the pgsodium RPC. Returns (ciphertext_bytea, nonce_bytea). */
async function encryptWith(nonce: Buffer, plaintext: string): Promise<Buffer> {
  const { data, error } = await adminClient().rpc("encrypt_token", {
    p_plaintext: plaintext,
    p_nonce: `\\x${nonce.toString("hex")}`,
  });
  if (error) throw new Error(`encrypt_token failed: ${error.message}`);
  // pgsodium returns bytea as \x-prefixed hex when coming back through PostgREST.
  if (typeof data !== "string") throw new Error("encrypt_token returned non-string.");
  return Buffer.from(data.replace(/^\\x/, ""), "hex");
}

async function decryptWith(ciphertext: Buffer, nonce: Buffer): Promise<string> {
  const { data, error } = await adminClient().rpc("decrypt_token", {
    p_ciphertext: `\\x${ciphertext.toString("hex")}`,
    p_nonce: `\\x${nonce.toString("hex")}`,
  });
  if (error) throw new Error(`decrypt_token failed: ${error.message}`);
  if (typeof data !== "string") throw new Error("decrypt_token returned non-string.");
  return data;
}

/** Decode a Postgres bytea column (either "\\x..." or base64) to a Buffer. */
function decodeBytea(v: string): Buffer {
  if (v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
  return Buffer.from(v, "base64");
}

export async function loadIntegration(orgId: string): Promise<IntegrationState | null> {
  const { data, error } = await adminClient()
    .from("airtable_integrations")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(`loadIntegration failed: ${error.message}`);
  if (!data) return null;
  const row = data as AirtableIntegrationRow;
  const nonce = decodeBytea(row.token_nonce);
  const accessToken = await decryptWith(decodeBytea(row.access_token_enc), nonce);
  const refreshToken = await decryptWith(decodeBytea(row.refresh_token_enc), nonce);
  return {
    orgId: row.org_id,
    accessToken,
    refreshToken,
    expiresAt: new Date(row.expires_at).getTime(),
    scope: row.scope,
    airtableUserId: row.airtable_user_id,
    airtableUserEmail: row.airtable_user_email,
    selectedBase:
      row.selected_base_id && row.selected_base_name
        ? {
            baseId: row.selected_base_id,
            baseName: row.selected_base_name,
            tableIds: row.table_ids ?? {},
            lastProvisionedAt: row.last_provisioned_at
              ? new Date(row.last_provisioned_at).getTime()
              : null,
          }
        : null,
    connectedAt: new Date(row.connected_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export interface SaveTokensArgs {
  orgId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  airtableUserId?: string | null;
  airtableUserEmail?: string | null;
}

export async function saveTokens(args: SaveTokensArgs): Promise<void> {
  const nonce = randomBytes(NONCE_LEN);
  const [accessEnc, refreshEnc] = await Promise.all([
    encryptWith(nonce, args.accessToken),
    encryptWith(nonce, args.refreshToken),
  ]);
  // Upsert: keep selected_base_* intact on re-auth.
  const { error } = await adminClient()
    .from("airtable_integrations")
    .upsert(
      {
        org_id: args.orgId,
        access_token_enc: `\\x${accessEnc.toString("hex")}`,
        refresh_token_enc: `\\x${refreshEnc.toString("hex")}`,
        token_nonce: `\\x${nonce.toString("hex")}`,
        expires_at: new Date(args.expiresAt).toISOString(),
        scope: args.scope,
        airtable_user_id: args.airtableUserId ?? null,
        airtable_user_email: args.airtableUserEmail ?? null,
      },
      { onConflict: "org_id" },
    );
  if (error) throw new Error(`saveTokens failed: ${error.message}`);
}

export interface SaveBaseArgs {
  orgId: string;
  baseId: string;
  baseName: string;
  tableIds?: Record<string, string>;
  lastProvisionedAt?: number | null;
}

export async function saveBase(args: SaveBaseArgs): Promise<void> {
  const update: Record<string, unknown> = {
    selected_base_id: args.baseId,
    selected_base_name: args.baseName,
  };
  if (args.tableIds !== undefined) update.table_ids = args.tableIds;
  if (args.lastProvisionedAt !== undefined) {
    update.last_provisioned_at = args.lastProvisionedAt
      ? new Date(args.lastProvisionedAt).toISOString()
      : null;
  }
  const { error } = await adminClient()
    .from("airtable_integrations")
    .update(update)
    .eq("org_id", args.orgId);
  if (error) throw new Error(`saveBase failed: ${error.message}`);
}

export async function clearIntegration(orgId: string): Promise<void> {
  const { error } = await adminClient()
    .from("airtable_integrations")
    .delete()
    .eq("org_id", orgId);
  if (error) throw new Error(`clearIntegration failed: ${error.message}`);
}

/* ---------------- OAuth state (PKCE verifier) storage ---------------- */

export async function storeOAuthState(
  state: string,
  codeVerifier: string,
  orgId: string,
  userId: string,
): Promise<void> {
  const { error } = await adminClient()
    .from("airtable_oauth_state")
    .insert({ state, code_verifier: codeVerifier, org_id: orgId, user_id: userId });
  if (error) throw new Error(`storeOAuthState failed: ${error.message}`);
}

export async function consumeOAuthState(
  state: string,
): Promise<{ codeVerifier: string; orgId: string; userId: string } | null> {
  const { data, error } = await adminClient()
    .from("airtable_oauth_state")
    .select("code_verifier, org_id, user_id")
    .eq("state", state)
    .maybeSingle();
  if (error) throw new Error(`consumeOAuthState failed: ${error.message}`);
  if (!data) return null;
  // Single-use: delete after read.
  await adminClient().from("airtable_oauth_state").delete().eq("state", state);
  return {
    codeVerifier: (data as { code_verifier: string }).code_verifier,
    orgId: (data as { org_id: string }).org_id,
    userId: (data as { user_id: string }).user_id,
  };
}

/** Purge oauth-state rows older than 10 minutes. Call from a scheduled job. */
export async function purgeStaleOAuthState(): Promise<number> {
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { error, count } = await adminClient()
    .from("airtable_oauth_state")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) throw new Error(`purgeStaleOAuthState failed: ${error.message}`);
  return count ?? 0;
}
