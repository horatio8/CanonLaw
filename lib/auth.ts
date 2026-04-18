import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server.ts";
import { adminClient } from "./supabase/admin.ts";
import type { OrgMemberRow, OrganizationRow, OrgRole } from "./supabase/types.ts";

export interface SessionUser {
  id: string;
  email: string;
}

export async function getUser(): Promise<SessionUser | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export interface Membership {
  org: OrganizationRow;
  role: OrgRole;
}

/** Fetch all orgs the current user belongs to, with their role. */
export async function listMyOrgs(): Promise<Membership[]> {
  const u = await getUser();
  if (!u) return [];
  // Service-role read so one query returns both org + role without extra RLS hops.
  const { data, error } = await adminClient()
    .from("org_members")
    .select("role, organizations:org_id(id, name, slug, created_at, created_by)")
    .eq("user_id", u.id)
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  // PostgREST returns foreign-table joins as arrays even when the relation is
  // one-to-one; flatten here.
  const rows = (data ?? []) as unknown as Array<{
    role: OrgRole;
    organizations: OrganizationRow | OrganizationRow[];
  }>;
  return rows.map((r) => ({
    org: Array.isArray(r.organizations) ? r.organizations[0]! : r.organizations,
    role: r.role,
  }));
}

/**
 * Get the currently selected org — from the `org` cookie, validated against
 * membership. Redirects to /admin/orgs if the user has no org yet.
 */
export async function requireCurrentOrg(): Promise<Membership> {
  const u = await requireUser();
  const cookies = await import("next/headers").then((m) => m.cookies());
  const cookieOrg = cookies.get("org")?.value;
  const memberships = await listMyOrgs();
  if (memberships.length === 0) {
    redirect("/admin/orgs");
  }
  const match =
    memberships.find((m) => m.org.id === cookieOrg) ?? memberships[0]!;
  // Enforce: only super_admin can touch the admin console actions we protect.
  if (match.role === "member") {
    // Members may still view /admin — but cannot mutate. Let callers enforce.
  }
  // Touch silence — `u` kept for potential audit use.
  void u;
  return match;
}

export async function requireSuperAdmin(): Promise<Membership> {
  const m = await requireCurrentOrg();
  if (m.role !== "super_admin") {
    throw new Error("Super-admin role required for this action.");
  }
  return m;
}

export type MembershipRoleCheck = (row: OrgMemberRow) => boolean;
