-- =============================================================================
-- Demo seed — creates a confirmed user and a demo organization.
--
--   Email:    vicar@example.com
--   Password: Tribunal2026!
--   Org:      "Demo Tribunal" (slug: demo-tribunal)
--
-- ⚠️  PREFER `npm run seed:demo` (scripts/seed-demo.ts). This raw SQL writes
-- directly to auth.users which CAN BREAK across Supabase versions whenever
-- they add a NOT-NULL column to the auth schema. The Node script uses the
-- Supabase Admin API and is version-stable.
--
-- This file is kept for offline / dashboard-only setups. If sign-in fails
-- after running this seed, try `npm run seed:demo` instead.
--
-- Run AFTER 20260418000000_init.sql:
--   supabase db reset             (locally; resets + applies migrations + seed)
--   OR paste this file into the SQL editor on a fresh project.
--
-- Idempotent: if the demo user/org already exists, the script is a no-op.
-- =============================================================================

-- pgcrypto provides crypt() / gen_salt() used by Supabase Auth for bcrypt.
create extension if not exists pgcrypto;

do $$
declare
  v_user_id    uuid;
  v_org_id     uuid;
  v_email      text := 'vicar@example.com';
  v_password   text := 'Tribunal2026!';
  v_org_name   text := 'Demo Tribunal';
  v_org_slug   text := 'demo-tribunal';
begin
  -- 1. Find or create the auth.users row.
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Demo Judicial Vicar"}'::jsonb,
      false,
      '',
      '',
      '',
      ''
    );

    -- Mirror identity row so the user can sign in with email/password.
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  end if;

  -- 2. Find or create the demo organization.
  select id into v_org_id from public.organizations where slug = v_org_slug;
  if v_org_id is null then
    insert into public.organizations(name, slug, created_by)
      values (v_org_name, v_org_slug, v_user_id)
      returning id into v_org_id;
  end if;

  -- 3. Ensure membership as super_admin.
  insert into public.org_members(org_id, user_id, role)
    values (v_org_id, v_user_id, 'super_admin')
    on conflict (org_id, user_id)
      do update set role = excluded.role;
end $$;

-- Convenience view for verifying the seed succeeded.
do $$ begin
  raise notice 'Demo account: % / password Tribunal2026! — org: Demo Tribunal',
    'vicar@example.com';
end $$;
