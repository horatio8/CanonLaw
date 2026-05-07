# Seeding the demo account — handoff for a coworker

You've been asked to run a one-time script that creates the demo login on a Supabase project. Takes about 5 minutes.

## What you'll do

Run `npm run seed:demo` against the Supabase project. It uses Supabase's Admin API to create:

- Email `vicar@example.com` / Password `Tribunal2026!` (pre-confirmed)
- Organization "Demo Tribunal", with that user as super-admin

The script is idempotent — if it's been partially run already, re-running just resets the password and re-asserts the membership.

---

## Prerequisites

- **Node.js 22 or newer** (`node -v` to check). Install from <https://nodejs.org> if needed.
- **Git** (`git --version`).
- **Two values from the Supabase dashboard** — see step 2 below.

## Step 1 — Clone the repo and install

```bash
git clone https://github.com/horatio8/canonlaw.git
cd canonlaw
git checkout claude/canon-law-tribunal-system-Uxraa
npm install
```

## Step 2 — Get the Supabase credentials

Open the Supabase project dashboard (the project owner will share access). Then:

1. Click **Project Settings** (gear icon, bottom left).
2. Click **API** in the sidebar.
3. Copy two things:
   - **Project URL** — looks like `https://abcdefghijkl.supabase.co`
   - **service_role** key under "Project API keys" — click *Reveal* first, it's a long `eyJ...` JWT.

> ⚠️ The `service_role` key bypasses Row-Level Security. Don't paste it into chat tools, don't commit it. After this script runs you can rotate it on the same page if you want to be safe.

## Step 3 — Apply the schema migration (skip if the project owner already did this)

In the Supabase dashboard, open **SQL Editor → New query**, paste the entire contents of [`supabase/migrations/20260418000000_init.sql`](../supabase/migrations/20260418000000_init.sql), and click **Run**. You should see "Success. No rows returned." If you get an error like `relation "organizations" already exists`, the migration was already applied — that's fine, move on.

## Step 4 — Run the seed

In your terminal, in the `canonlaw` folder:

```bash
export NEXT_PUBLIC_SUPABASE_URL='https://YOUR-REF.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='eyJ...your-long-key...'
npm run seed:demo
```

(On Windows PowerShell, replace `export X=...` with `$env:X = '...'`.)

You should see:

```
✓ Created user vicar@example.com (<uuid>)
✓ Created org "Demo Tribunal" (<uuid>)
✓ Membership super_admin asserted

Demo account ready:
  Email:    vicar@example.com
  Password: Tribunal2026!
  Org:      Demo Tribunal (slug: demo-tribunal)
```

## Step 5 — Verify

Open the deployed app's `/login` page and try signing in with:

- Email: `vicar@example.com`
- Password: `Tribunal2026!`

You should land in the admin console with "Demo Tribunal" selected as your organization.

---

## Troubleshooting

**"createUser failed: User already registered"** → the user exists from a prior attempt. Re-run `npm run seed:demo`; the script detects this and resets the password instead.

**"relation 'organizations' does not exist"** → the schema migration (step 3) wasn't run. Apply it.

**Sign-in still fails after the script** → check the project's **Authentication → Providers → Email** is enabled. If "Confirm email" is on, you can leave it on (the demo user is created with `email_confirm: true` so it bypasses the requirement) — but new self-signups will need to click their confirmation link.

**`npm install` errors about Node version** → you're on an older Node. Install Node 22+: <https://nodejs.org>.

**Need different credentials?** → set env vars before running:

```bash
export DEMO_EMAIL='someone@example.com'
export DEMO_PASSWORD='AnotherSecurePassword!'
export DEMO_ORG_NAME='My Tribunal'
export DEMO_ORG_SLUG='my-tribunal'
npm run seed:demo
```

## When you're done

Tell the project owner the seed succeeded. They can then sign in and continue the Airtable connection from `/admin`. There's nothing to commit — the script writes only to Supabase.
