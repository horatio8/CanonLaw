# Deployment — Vercel + Supabase + Airtable

End-to-end guide to deploy the Canon Law Tribunal admin and its multi-tenant Airtable integration.

High-level topology:

```
   ┌──────────────┐     magic-link      ┌──────────────┐
   │  Browser     │◄────email───────────│   Supabase   │  auth.users
   │  (super      │                     │    Auth      │
   │   admin)     │  OAuth (PKCE)       └──────┬───────┘
   │              │─────────────────────┐      │ service-role
   │              │                     │      │  RPC
   │              │◄───────────────┐    ▼      ▼
   └──────┬───────┘                │  ┌─────────────────┐
          │ HTTPS                  │  │  Supabase DB     │
          ▼                        │  │  organizations   │
   ┌──────────────┐                │  │  org_members     │
   │   Vercel     │◄──────── reads ┘  │  airtable_*      │
   │  (Next.js)   │                   │  pgsodium vault  │
   │              │─── Airtable ─────►└─────────────────┘
   │  /admin      │     OAuth / API
   │  /api/...    │
   └──────────────┘                   ┌─────────────────┐
                                      │    Airtable     │
                                      │   (one base     │
                                      │    per org)     │
                                      └─────────────────┘
```

---

## 1. Provision Supabase

1. Create a Supabase project at <https://supabase.com/dashboard> (it takes ~2 min).
2. Copy **Project URL**, **anon public key**, and **service_role key** from **Project Settings → API**.
3. Apply the schema:
   - **Option A (CLI):**
     ```
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
   - **Option B (manual):** open **SQL Editor**, paste `supabase/migrations/20260418000000_init.sql`, run.

   Then seed the demo user (use the **script** — it's version-stable across Supabase releases; the raw-SQL `supabase/seed.sql` may break when Supabase adds NOT-NULL columns to `auth.users`):
     ```
     export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
     export SUPABASE_SERVICE_ROLE_KEY=eyJ...    # from Project Settings → API
     npm run seed:demo
     ```
   It's idempotent — if the user exists it just resets the password and re-asserts super-admin membership.
4. Under **Authentication → Providers → Email**, make sure **Email** is enabled. For the demo flow, you may want to **disable "Confirm email"** so new accounts can sign in immediately. The demo seed user is pre-confirmed regardless.
5. Under **Authentication → URL Configuration**:
   - **Site URL:** your production Vercel URL (e.g. `https://canonlaw.example.com`).
   - **Redirect URLs:** add `https://<your-domain>/auth/callback` (and your Vercel preview pattern if desired: `https://*.vercel.app/auth/callback`).

That's it for Supabase. The migration creates `organizations`, `org_members`, `airtable_integrations`, `airtable_oauth_state`, the `create_organization` RPC, and pgsodium-backed `encrypt_token` / `decrypt_token` functions.

## 2. Register an Airtable OAuth integration

1. Go to <https://airtable.com/create/oauth> and create a new integration.
2. **Name:** "Canon Law Tribunal" (or whatever).
3. **Scopes:** request exactly:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
   - `schema.bases:write`
4. **Redirect URIs:** add both
   - `https://<your-vercel-domain>/api/airtable/callback` (production)
   - `http://localhost:3000/api/airtable/callback` (local dev, optional)
5. Copy the **Client ID** (and **Client Secret** if you chose a confidential client).

One integration serves all orgs — each tenant authorizes their own Airtable account against it. You do not need a separate integration per diocese.

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel (<https://vercel.com/new>).
3. **Framework Preset:** Next.js (auto-detected).
4. **Environment Variables** — set for `Production` (and `Preview` if you want previews to work):

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (secret!) |
   | `NEXT_PUBLIC_APP_URL` | `https://<your-vercel-domain>` |
   | `AIRTABLE_CLIENT_ID` | from step 2 |
   | `AIRTABLE_CLIENT_SECRET` | from step 2 (only if confidential) |
   | `VERCEL_CRON_SECRET` | any long random string; used by the purge cron |

5. **Deploy.** Vercel will build and host. The `vercel.json` in this repo:
   - Gives `/api/airtable/callback` a 30s function timeout (base-creation round-trip).
   - Gives the provision server actions a 60s timeout (Pro plan or above is required for >10s).
   - Schedules `/api/cron/purge-oauth-state` to run hourly.

### Timeout note

Creating a brand-new base with 13 tables + 28 seed grounds can take 15–30s end-to-end. The limits:

| Plan | Max function duration | Fit? |
|------|-----------------------|------|
| Hobby | 10s | Not reliable — use **Sync schema** on an empty base, or upgrade. |
| Pro | 60s | Comfortable. |
| Enterprise | 900s | Plenty. |

If you stay on Hobby, create the base in Airtable first (empty), then in this app click **Select**, then **Sync schema** — that splits the work into separate requests that each fit inside 10s.

## 4. Point Supabase Auth at Vercel

On your Supabase project → **Authentication → URL Configuration**, set the Site URL to your Vercel production URL. Without this, magic links will redirect back to `localhost`.

## 5. First run (super-admin bootstrap)

### Demo account (fastest path)

If you ran `supabase/seed.sql`, a pre-confirmed demo user and a "Demo Tribunal" organization already exist:

| Field | Value |
|-------|-------|
| URL | `https://<your-vercel-domain>/login` |
| Email | `vicar@example.com` |
| Password | `Tribunal2026!` |
| Org | Demo Tribunal (you are super-admin) |

Log in, go to **Status**, click **Connect Airtable**, approve scopes, then on **Bases** either pick an existing base or create a new one. Finally **Sync schema** + **Seed canonical grounds of nullity**.

> ⚠️ Change the demo password (or delete the demo user) before any real data goes anywhere near this.

### Fresh account flow

1. Open `https://<your-vercel-domain>` → **Sign in** → click **Create account**.
2. If "Confirm email" is enabled in Supabase, click the confirmation link, then sign back in.
3. You land on `/admin/orgs`. **Create an organization** — name + slug. You become its super-admin.
4. **Status** → **Connect Airtable** → approve → **Bases** → select or create → **Sync schema** → **Seed grounds**.

Other users at your organization can sign up, then a super-admin adds them to `org_members` (via SQL for now) as `admin` or `member`.

## 6. Local development

```
cp .env.example .env.local
# fill in Supabase + Airtable vars; set NEXT_PUBLIC_APP_URL=http://localhost:3000
npm install
npm run dev
```

Open <http://localhost:3000>. Magic-link emails go through the same Supabase project (which is fine for dev — Supabase throttles them).

## 7. Security checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` set only in Vercel server env; never in the client.
- [ ] Airtable redirect URI on the OAuth integration exactly matches `NEXT_PUBLIC_APP_URL/api/airtable/callback`.
- [ ] Row-Level Security is enabled on every public table (it is, by the migration).
- [ ] `VERCEL_CRON_SECRET` set so `/api/cron/*` isn't world-callable.
- [ ] Supabase **Auth → URL Configuration** Site URL matches your production domain.
- [ ] Vercel domain added to Supabase Auth's allowed redirect URLs.
- [ ] `CANONLAW_MASTER_KEY` is **not** set in Vercel — it's only for the legacy local CLI (`npm run admin:local`).

## 8. Observability

- Supabase logs: **Database → Logs**, **Auth → Logs**, **API → Logs**.
- Vercel logs: `vercel logs` or the dashboard function logs.
- Airtable: each tenant can see every request their integration made under their workspace settings.

## 9. Tearing down a tenant

To remove an organization's data without touching Supabase Auth:

```sql
delete from public.organizations where id = '<uuid>';
-- cascades to org_members, airtable_integrations, airtable_oauth_state.
```

The Airtable base itself is the tenant's data — only they can delete it from the Airtable UI.

## 10. What's next

The super-admin loop described in the spec (Phase 1) is now deployable. The remaining engine modules (state machine, gates, deadlines, permissions, document generation) run inside Next.js server actions and API routes; point them at the Airtable base via the provisioned `tableIds` map stored on the integration row.
