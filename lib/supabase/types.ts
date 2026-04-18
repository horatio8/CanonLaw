/**
 * Minimal typed shape of the Supabase schema used by the app.
 * Expand as needed; for heavier usage run `supabase gen types`.
 */

export type OrgRole = "super_admin" | "admin" | "member";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  created_by: string | null;
}

export interface OrgMemberRow {
  org_id: string;
  user_id: string;
  role: OrgRole;
  added_at: string;
}

export interface AirtableIntegrationRow {
  org_id: string;
  access_token_enc: string; // hex / base64 depending on pg encoding
  refresh_token_enc: string;
  token_nonce: string;
  expires_at: string;
  scope: string;
  airtable_user_id: string | null;
  airtable_user_email: string | null;
  selected_base_id: string | null;
  selected_base_name: string | null;
  table_ids: Record<string, string>;
  last_provisioned_at: string | null;
  connected_at: string;
  updated_at: string;
}
