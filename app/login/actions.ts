"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server.ts";

function backToLogin(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/login?${qs}`);
}

export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  if (!email || !password) backToLogin({ error: "Email and password required.", next });

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) backToLogin({ error: error.message, next });
  redirect(next);
}

export async function signUp(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  if (!email || !password) backToLogin({ error: "Email and password required.", next });
  if (password.length < 8) backToLogin({ error: "Password must be at least 8 characters.", next });

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) backToLogin({ error: error.message, next });

  // If email confirmation is enabled in the Supabase project, the user has no
  // session yet — they must click the confirmation link first. Otherwise the
  // signUp call already established a session.
  if (!data.session) {
    backToLogin({ confirm: email, next });
  }
  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/");
}
