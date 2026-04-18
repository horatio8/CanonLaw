"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server.ts";
import { appUrl } from "../../lib/supabase/env.ts";

export async function sendMagicLink(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const next = String(formData.get("next") ?? "/admin");
  if (!email) redirect(`/login?error=${encodeURIComponent("Email required.")}`);
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(`/login?sent=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}
