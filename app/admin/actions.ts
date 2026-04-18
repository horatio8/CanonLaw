"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listMyOrgs } from "../../lib/auth.ts";

export async function switchOrg(formData: FormData): Promise<void> {
  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) redirect("/admin");
  const memberships = await listMyOrgs();
  if (!memberships.some((m) => m.org.id === orgId)) {
    throw new Error("Not a member of the selected organization.");
  }
  cookies().set("org", orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/admin");
}
