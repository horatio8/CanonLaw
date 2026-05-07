#!/usr/bin/env node
/**
 * Seed (or repair) the demo account.
 *
 * Uses Supabase's Admin API to create the user, which is version-stable across
 * Supabase releases. The raw-SQL seed in supabase/seed.sql can break when
 * Supabase adds NOT-NULL columns to auth.users; this script doesn't.
 *
 * Run AFTER the schema migration is applied. From the repo root:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npm run seed:demo
 *
 * Idempotent: if the user already exists, the password is reset and the
 * membership is re-asserted as super_admin.
 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const EMAIL = process.env.DEMO_EMAIL ?? "vicar@example.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "Tribunal2026!";
const ORG_NAME = process.env.DEMO_ORG_NAME ?? "Demo Tribunal";
const ORG_SLUG = process.env.DEMO_ORG_SLUG ?? "demo-tribunal";

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUser(email: string): Promise<{ id: string } | null> {
  // listUsers is paginated; demo realm should have only a handful of users.
  let page = 1;
  while (page < 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return { id: hit.id };
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

async function main(): Promise<void> {
  // ---- 1. Find or create the auth user ----
  let userId: string;
  const existing = await findUser(EMAIL);
  if (existing) {
    userId = existing.id;
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`updateUserById failed: ${error.message}`);
    console.log(`✓ Reset password for existing user ${EMAIL} (${userId})`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Demo Judicial Vicar" },
    });
    if (error) throw new Error(`createUser failed: ${error.message}`);
    if (!data.user) throw new Error("createUser returned no user.");
    userId = data.user.id;
    console.log(`✓ Created user ${EMAIL} (${userId})`);
  }

  // ---- 2. Find or create the demo organization ----
  let orgId: string;
  const { data: orgRow, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .maybeSingle();
  if (orgErr) throw new Error(`select org failed: ${orgErr.message}`);
  if (orgRow) {
    orgId = (orgRow as { id: string }).id;
    console.log(`✓ Org "${ORG_NAME}" already exists (${orgId})`);
  } else {
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name: ORG_NAME, slug: ORG_SLUG, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(`insert org failed: ${error.message}`);
    orgId = (data as { id: string }).id;
    console.log(`✓ Created org "${ORG_NAME}" (${orgId})`);
  }

  // ---- 3. Ensure super_admin membership ----
  const { error: memErr } = await supabase
    .from("org_members")
    .upsert(
      { org_id: orgId, user_id: userId, role: "super_admin" },
      { onConflict: "org_id,user_id" },
    );
  if (memErr) throw new Error(`upsert membership failed: ${memErr.message}`);
  console.log(`✓ Membership super_admin asserted`);

  console.log("");
  console.log("Demo account ready:");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Org:      ${ORG_NAME} (slug: ${ORG_SLUG})`);
}

main().catch((e: Error) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
