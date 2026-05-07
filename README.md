# Canon Law Tribunal Management System

End-to-end judicial process management for marriage nullity cases in diocesan and interdiocesan tribunals of the Catholic Church.

**Legal basis:** 1983 Code of Canon Law as amended by *Mitis Iudex Dominus Iesus* (2015), supplemented by *Dignitas Connubii* (2005). Where conflict exists, post-2015 canons control.

---

## What this repository contains

This repository is the **canonical core** of the tribunal platform. It is deliberately framework-light: all four engines (role-permission, case state, document generation, deadline-and-audit) are implemented as pure TypeScript so they can be called from an Airtable Scripting Block, a serverless function, a Node worker, or any other runtime.

| Path | Purpose |
|------|---------|
| `schema/airtable-schema.json` | The 13 Airtable tables with all fields and single-select options. Drive provisioning via Airtable Metadata API. |
| `schema/seed-grounds.json` | Grounds of nullity keyed to their canons (cc. 1083–1108). |
| `src/types/canonical.ts` | Domain types mapped 1:1 to the Airtable schema. |
| `src/deadlines/time.ts` | Canonical time primitives — continuous vs. useful time, canonical month/year, tribunal-closure extension (cc. 200–203; c. 1467). |
| `src/deadlines/catalog.ts` | Deadline catalog with canon reference, duration, computation, severity. |
| `src/state-machine/states.ts` | 14-state ordinary, 8-state briefer, and 6-state documentary process machines. |
| `src/state-machine/gates.ts` | Hard validation gates per spec §8 — no transition without all prerequisites. |
| `src/permissions/matrix.ts` | Role × state × action matrix. |
| `src/incompatibility/rules.ts` | cc. 1447–1448 / DC arts. 66–67 hard blocks. |
| `src/documents/templates.ts` | Document generators enforcing cc. 1611–1612 and related form requirements. |
| `src/automations/recipes.ts` | Pure-function automation triggers (Airtable Automations, cron, etc.). |
| `tests/` | Node:test suites covering deadlines, gates, incompatibility, permissions, templates, state machine, automations. |

Run:

```
npm install
npm run typecheck
npm test
```

---

## Four interlocking engines

1. **Role & Permission** — `src/permissions/matrix.ts`. Every screen exposes only legally-possible actions for the current role and state.
2. **Case State** — `src/state-machine/states.ts` + `src/state-machine/gates.ts`. No transition without all prerequisites met (spec §8).
3. **Document Generation** — `src/documents/templates.ts`. Templates enforce cc. 1611–1612 and will refuse to finalize a sentence without required signatories or content elements.
4. **Deadline & Audit** — `src/deadlines/time.ts` + `src/deadlines/catalog.ts`. Distinguishes continuous vs. useful time (cc. 200–203), extends to first open day on tribunal closure (c. 1467).

---

## State machines

* **Ordinary matrimonial process** — 14 forward states plus the Rejected side-state. See `ORDINARY_TRANSITIONS`.
* **Briefer process before the Bishop** — 8 states (cc. 1683–1687). Bishop may remand to ordinary (c. 1687 §1), never issue a negative sentence.
* **Documentary process** — 6 states (c. 1688). Remand path to ordinary when certainty lacking.

Every transition references a named gate. The gate is enforced pure-functionally against a `CaseSnapshot`: the case record plus its acts, assignments, deadlines, and service records.

---

## Validation gates (hard stops)

Gates are keyed to the table in spec §8. Representative examples enforced here:

| Transition | Representative hard stops |
|-----------|---------------------------|
| Intake → Pre-Admission | Libellus must be **notary-authenticated** (c. 1437). |
| Pre-Admission → Admitted | Competence basis recorded; standing check done; **DBI pre-admission votum** filed or formally waived with reason (DC art. 119 §2). |
| Formula → Constitution | Formula decree authenticated; **10-day recourse window** (c. 1513 §3) has passed. |
| Constitution → Instruction | ≥ 3 judges (c. 1425), DBI, and notary assigned; no incompatibilities. |
| Instruction → Publication | **No unauthenticated acts** in the file (c. 1437). |
| Conclusion → Deliberation | **DBI observations filed (mandatory)**; discussion period expired. |
| Sentence Drafting → Publication | Sentence passes cc. 1611–1612 element check; **notary has signed** (VALIDITY). |
| Appeal → Executive | 15-useful-day petition window expired; DBI has filed appeal-OR-non-appeal statement (DC art. 279 §2). |

---

## Deadlines

Canonical time rules implemented verbatim from cc. 200–203:

* Day of commencement excluded (c. 203 §1).
* Canonical month = 30 days; canonical year = 365 days (c. 202 §2).
* Useful time suspends on days the person cannot effectively act (c. 201 §2).
* Tribunal-closed-day extension on judicial acts (c. 1467; DC art. 83).

Validity-flagged deadlines (red): **appeal petition** (c. 1630), **appeal prosecution** (c. 1633).

Procedural deadlines (amber): respondent response (c. 1676 §1), formula recourse (c. 1513 §3), discussion briefs (c. 1601), sentence drafting (DC art. 249 §5), briefer-process session (c. 1685).

Advisory (yellow): 1-year first-instance benchmark (c. 1453), 6-month second-instance benchmark.

---

## Role incompatibilities (c. 1447; c. 1448; DC art. 66)

Enforced as hard blocks at assignment time:

* Judge + defender/promoter on the same case.
* Judge across two connected instances of the same cause.
* Advocate/procurator + defender/promoter in the same cause (DC art. 36 §3).
* Consanguinity/affinity within 4th-degree collateral or any direct-line degree.
* Prior-instance judge or assessor barred from higher instance of the same cause.
* Prior defender/promoter/procurator/advocate/witness/expert barred from judging the same cause.

---

## Document generation

All templates return Markdown with explicit signature blocks. Where a canonical requirement is absent (e.g. the rejection decree lacks stated reasons per c. 1505 §2, or a sentence lacks a required element of cc. 1611–1612), the generator throws rather than emitting invalid output.

Generators included: Admission Decree, Rejection Decree, Citation Decree, Formula of Doubt Decree, Constitution Decree, Sentence (full cc. 1611–1612 structure), Executive Status Notice.

---

## Airtable schema

`schema/airtable-schema.json` defines the 13 tables listed in spec §7:

1. Cases
2. Persons
3. Tribunal Personnel
4. Case Assignments
5. Grounds of Nullity
6. Case Grounds
7. Acts
8. Deadlines
9. Service Records
10. Tribunals
11. Dioceses
12. Tribunal Calendar
13. Audit Log

Provisioning approach: pass this file to an Airtable Metadata API client to create a fresh base, then seed `schema/seed-grounds.json` into the Grounds of Nullity table.

---

## Super-admin: connect Airtable & select a base

Two paths:

1. **Production (Vercel + Supabase + Airtable)** — multi-tenant Next.js app with magic-link auth and per-org Airtable integrations. See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for step-by-step setup.
2. **Local single-tenant CLI** — `npm run admin:local` launches a small Express console with filesystem-based encrypted token storage. Useful for solo development; not recommended for deployment.

### Production quick start

Prerequisites:

- Supabase project (apply `supabase/migrations/20260418000000_init.sql`).
- Airtable OAuth integration (<https://airtable.com/create/oauth>) with scopes `data.records:read/write`, `schema.bases:read/write` and redirect URI `https://<your>/api/airtable/callback`.
- Vercel project with the env vars listed in `.env.example`.

Then:

```
npm install
npm run dev     # local
npm run build   # production build (Vercel runs this)
```

### Demo credentials

If you applied `supabase/seed.sql`, the project ships with a pre-confirmed demo account and a "Demo Tribunal" organization:

| | |
|---|---|
| **Email** | `vicar@example.com` |
| **Password** | `Tribunal2026!` |
| **Org** | Demo Tribunal (you are super-admin) |

Log in, click **Connect Airtable**, then pick or create a base. Change or delete this account before going to production.

The super-admin flow:

1. Visit `/` → **Sign in** with email + password (or **Create account**).
2. Create an **Organization** if you don't already have one — you become its super-admin.
3. **Connect Airtable** → approve scopes → pick an existing base or create a new one from the 13-table schema.
4. **Sync schema** + **Seed grounds** to finish provisioning.

Tokens are encrypted at rest in Supabase via `pgsodium`; RLS ensures one tenant can never see another's integration.

### Local CLI (legacy)

```
AIRTABLE_CLIENT_ID=... CANONLAW_MASTER_KEY=$(openssl rand -hex 32) npm run admin:local
```

Opens <http://localhost:3000> with the same flow. Config lands encrypted at `~/.canonlaw-tribunal/config.json.enc`.

## Intended integration

The core engines are **pure TypeScript**. A deployment pulls them into one of:

* **Airtable Scripting Block / Automation** — import the compiled bundle; call `canTransition`, `createDeadline`, `checkIncompatibilities`, and the document generators from button/event handlers.
* **Node worker** — run the automation recipes on cron; each recipe returns a list of `SideEffect` values that the worker dispatches (create deadline record, alert notary, transition status, etc.).
* **Any web app** — the permission matrix can gate UI; the state machine can drive tab/button visibility.

---

## Roadmap

Phase 1 (this repo): ordinary matrimonial process, complete.
Phase 2: briefer-process refinements and bishop-workspace hooks.
Phase 3: documentary gatekeeping and narrow-basis enforcement.
Phase 4: second-instance workflows; complaint-of-nullity; rogatory communications; Apostolic Signatura reporting.

---

## Non-goals

* The system does **not** dissolve marriages. It judges whether a marriage was invalid *ab initio*.
* The sentence editor is template-driven but not rigidly auto-written. Any AI assistance is advisory with full audit trail.
* The Bishop cannot issue a negative sentence in briefer process; such a case is remanded to ordinary (c. 1687 §1).
