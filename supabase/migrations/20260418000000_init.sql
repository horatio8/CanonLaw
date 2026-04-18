-- =============================================================================
-- Canon Law Tribunal — Supabase schema
--
-- Multi-tenant model: users belong to one or more organizations; each org
-- owns at most one Airtable integration (tokens + selected base). Tokens are
-- encrypted with pgsodium / Vault so they never sit in Postgres as plaintext.
--
-- To run:
--   supabase db push               (local / linked project)
--   OR paste contents into the Supabase SQL editor of a fresh project.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pgsodium;

-- -----------------------------------------------------------------------------
-- Vault: ensure a secret exists for encrypting integration tokens.
--
-- We store a single symmetric key in Supabase Vault; every integration row
-- references it by id (stored in app.settings). For a real production rollout
-- you may prefer per-org keys; keeping it simple here.
-- -----------------------------------------------------------------------------
do $$
declare
  v_key_id uuid;
begin
  select id into v_key_id from pgsodium.key where name = 'canonlaw_tokens';
  if v_key_id is null then
    select pgsodium.create_key(name := 'canonlaw_tokens') into v_key_id;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Organizations — a diocese, tribunal, or interdiocesan grouping.
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

comment on table public.organizations is 'A tribunal tenant — one diocese or interdiocesan entity.';

-- -----------------------------------------------------------------------------
-- Org members — maps auth.users to organizations with a role.
--
-- super_admin: can connect/disconnect Airtable, select/create bases, invite.
-- admin: can invite users, view integration status.
-- member: view-only.
-- -----------------------------------------------------------------------------
create type public.org_role as enum ('super_admin', 'admin', 'member');

create table public.org_members (
  org_id       uuid not null references public.organizations(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.org_role not null default 'member',
  added_at     timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index org_members_user_idx on public.org_members(user_id);

-- -----------------------------------------------------------------------------
-- Airtable integrations — one row per org. Tokens are encrypted at rest.
-- -----------------------------------------------------------------------------
create table public.airtable_integrations (
  org_id              uuid primary key references public.organizations(id) on delete cascade,
  access_token_enc    bytea not null,
  refresh_token_enc   bytea not null,
  token_nonce         bytea not null,
  expires_at          timestamptz not null,
  scope               text not null,
  airtable_user_id    text,
  airtable_user_email text,
  selected_base_id    text,
  selected_base_name  text,
  table_ids           jsonb not null default '{}'::jsonb,
  last_provisioned_at timestamptz,
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Trigger keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_airtable_integrations_touch
  before update on public.airtable_integrations
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- OAuth state — short-lived PKCE verifiers keyed by random state token.
-- Cleaned periodically by a cron (or ignored — rows expire functionally).
-- -----------------------------------------------------------------------------
create table public.airtable_oauth_state (
  state          text primary key,
  code_verifier  text not null,
  org_id         uuid not null references public.organizations(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now()
);

create index airtable_oauth_state_created_idx on public.airtable_oauth_state(created_at);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.airtable_integrations enable row level security;
alter table public.airtable_oauth_state enable row level security;

-- helper: is the caller a member of the given org?
create or replace function public.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid()
  )
$$;

create or replace function public.is_super_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid() and role = 'super_admin'
  )
$$;

-- organizations: readable by members; writable by super_admin of THAT row; any
-- authenticated user can INSERT a new org (they become its super_admin via the
-- `create_organization` RPC below).
create policy org_select on public.organizations
  for select using (public.is_member(id));

create policy org_update on public.organizations
  for update using (public.is_super_admin(id));

-- Creation path is through the SECURITY DEFINER function only.
revoke insert on public.organizations from anon, authenticated;

-- org_members: a member sees their own org's members; super_admin can add/remove.
create policy org_members_select on public.org_members
  for select using (public.is_member(org_id));

create policy org_members_insert on public.org_members
  for insert with check (public.is_super_admin(org_id));

create policy org_members_update on public.org_members
  for update using (public.is_super_admin(org_id));

create policy org_members_delete on public.org_members
  for delete using (public.is_super_admin(org_id));

-- airtable_integrations: members read, super_admin writes.
create policy integrations_select on public.airtable_integrations
  for select using (public.is_member(org_id));

create policy integrations_insert on public.airtable_integrations
  for insert with check (public.is_super_admin(org_id));

create policy integrations_update on public.airtable_integrations
  for update using (public.is_super_admin(org_id));

create policy integrations_delete on public.airtable_integrations
  for delete using (public.is_super_admin(org_id));

-- oauth_state: writable + readable only by the owning user for their org.
create policy oauth_state_owner on public.airtable_oauth_state
  for all using (user_id = auth.uid() and public.is_super_admin(org_id))
          with check (user_id = auth.uid() and public.is_super_admin(org_id));

-- -----------------------------------------------------------------------------
-- create_organization(name, slug) RPC — callable by any authenticated user.
-- Creates the org and adds the caller as super_admin atomically.
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.organizations(name, slug, created_by)
    values (p_name, p_slug, auth.uid())
    returning id into v_org;
  insert into public.org_members(org_id, user_id, role)
    values (v_org, auth.uid(), 'super_admin');
  return v_org;
end $$;

grant execute on function public.create_organization(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- encrypt_integration_tokens / decrypt_integration_tokens helpers
--
-- Symmetric encryption keyed on the pgsodium 'canonlaw_tokens' key. Called by
-- the app server via the service-role client; not exposed to end-users.
-- -----------------------------------------------------------------------------
create or replace function public.encrypt_token(p_plaintext text, p_nonce bytea)
returns bytea
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key_id uuid;
begin
  select id into v_key_id from pgsodium.key where name = 'canonlaw_tokens';
  if v_key_id is null then
    raise exception 'pgsodium key canonlaw_tokens is missing';
  end if;
  return pgsodium.crypto_aead_det_encrypt(
    convert_to(p_plaintext, 'utf8'),
    p_nonce,
    v_key_id
  );
end $$;

create or replace function public.decrypt_token(p_ciphertext bytea, p_nonce bytea)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key_id uuid;
begin
  select id into v_key_id from pgsodium.key where name = 'canonlaw_tokens';
  if v_key_id is null then
    raise exception 'pgsodium key canonlaw_tokens is missing';
  end if;
  return convert_from(
    pgsodium.crypto_aead_det_decrypt(p_ciphertext, p_nonce, v_key_id),
    'utf8'
  );
end $$;

revoke execute on function public.encrypt_token(text, bytea) from public, anon, authenticated;
revoke execute on function public.decrypt_token(bytea, bytea) from public, anon, authenticated;
grant  execute on function public.encrypt_token(text, bytea) to service_role;
grant  execute on function public.decrypt_token(bytea, bytea) to service_role;
