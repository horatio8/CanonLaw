"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server.ts";
import { requireUser } from "../../../lib/auth.ts";

export async function createOrg(formData: FormData): Promise<void> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!name || !slug) {
    redirect(`/admin/orgs?error=${encodeURIComponent("Name and slug are required.")}`);
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_slug: slug,
  });
  if (error) {
    redirect(`/admin/orgs?error=${encodeURIComponent(error.message)}`);
  }
  const orgId = typeof data === "string" ? data : null;
  if (orgId) {
    cookies().set("org", orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  redirect("/admin");
}
