/**
 * Super-admin HTTP server — handles Airtable OAuth and base selection.
 *
 * Routes:
 *   GET  /                    — status + CTA to connect
 *   GET  /auth/login          — kick off OAuth (PKCE)
 *   GET  /auth/callback       — exchange code; redirect to /bases
 *   POST /auth/logout         — clear stored tokens
 *   GET  /bases                — list accessible bases + action to select
 *   POST /bases/select         — save chosen base id
 *   POST /bases/provision     — upsert our schema into the selected base
 *   POST /bases/create        — create a new base from our schema (needs workspaceId)
 *   POST /bases/seed-grounds  — insert canonical grounds into the selected base
 *
 * HTML is intentionally minimal (no client framework). This is an admin tool,
 * not a public surface.
 */

import express, { type Request, type Response, type NextFunction } from "express";
import cookieSession from "cookie-session";
import { randomBytes } from "node:crypto";
import { AirtableClient } from "./client.ts";
import {
  buildAuthorizeRequest,
  exchangeCodeForToken,
  loadClientConfigFromEnv,
  refreshAccessToken,
  type OAuthClientConfig,
} from "./oauth.ts";
import { configStore, type StoredConfig } from "./config-store.ts";
import {
  provisionExistingBase,
  provisionNewBase,
  seedGrounds,
} from "./provisioner.ts";

interface SessionData {
  oauth?: { codeVerifier: string; state: string } | undefined;
  flash?: string | undefined;
}

function getSession(req: Request): SessionData | null {
  return (req.session as SessionData | null) ?? null;
}

export interface AdminServerOptions {
  port?: number;
  oauth?: OAuthClientConfig;
}

/** Ensure we have a fresh access token; refresh if <60s from expiry. */
async function ensureAccessToken(cfg: OAuthClientConfig): Promise<string> {
  const stored = configStore.load();
  if (!stored.airtable) throw new Error("Not connected to Airtable.");
  const { accessToken, refreshToken, expiresAt } = stored.airtable;
  if (Date.now() < expiresAt - 60_000) return accessToken;
  const fresh = await refreshAccessToken(cfg, refreshToken);
  configStore.update((c) => {
    c.airtable = {
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      expiresAt: Date.now() + fresh.expires_in * 1000,
      tokenType: "Bearer",
      scope: fresh.scope,
    };
  });
  return fresh.access_token;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function layout(title: string, body: string, flash?: string | undefined): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} — Canon Law Tribunal</title>
  <style>
    body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.4rem; border-bottom: 1px solid #ddd; padding-bottom: .4rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; }
    button, .btn { background: #0b6bcb; color: #fff; border: 0; padding: .55rem 1rem; border-radius: 4px; cursor: pointer; font-size: .95rem; text-decoration: none; display: inline-block; }
    button.secondary, .btn.secondary { background: #555; }
    button.danger { background: #c0392b; }
    form { display: inline; }
    ul.bases { list-style: none; padding: 0; }
    ul.bases li { border: 1px solid #ddd; border-radius: 4px; padding: .7rem; margin-bottom: .4rem; display: flex; align-items: center; gap: 1rem; }
    code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-size: .9em; }
    .flash { background: #fff4c7; border: 1px solid #e2c200; padding: .6rem .9rem; border-radius: 4px; margin-bottom: 1rem; }
    .muted { color: #666; font-size: .9em; }
    nav { margin-bottom: 1rem; }
    nav a { margin-right: 1rem; }
  </style>
</head>
<body>
  <nav><a href="/">Status</a> <a href="/bases">Bases</a></nav>
  <h1>${escapeHtml(title)}</h1>
  ${flash ? `<div class="flash">${escapeHtml(flash)}</div>` : ""}
  ${body}
</body>
</html>`;
}

function render(res: Response, req: Request, title: string, body: string): void {
  const s = getSession(req);
  const flash = s?.flash;
  if (s) s.flash = undefined;
  res.type("html").send(layout(title, body, flash));
}

export function createAdminServer(opts: AdminServerOptions = {}): express.Express {
  const oauthCfg = opts.oauth ?? loadClientConfigFromEnv();

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(
    cookieSession({
      name: "canonlaw_admin",
      keys: [process.env.CANONLAW_SESSION_KEY ?? randomBytes(32).toString("hex")],
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    }),
  );

  /* -------- Status / home -------- */

  app.get("/", (req, res) => {
    const cfg: StoredConfig = configStore.load();
    const connected = Boolean(cfg.airtable);
    const base = cfg.selectedBase;
    const body = `
      <p><strong>Airtable connection:</strong> ${connected ? "✅ Connected" : "⛔ Not connected"}</p>
      ${connected
        ? `<form method="post" action="/auth/logout"><button class="danger" type="submit">Disconnect</button></form>`
        : `<a class="btn" href="/auth/login">Connect Airtable</a>`}
      <h2>Selected base</h2>
      ${base
        ? `<p><strong>${escapeHtml(base.baseName)}</strong> <code>${escapeHtml(base.baseId)}</code><br>
           <span class="muted">Selected ${new Date(base.selectedAt).toLocaleString()}${
             base.lastProvisionedAt ? ` · Last provisioned ${new Date(base.lastProvisionedAt).toLocaleString()}` : ""
           }</span></p>
           <p><a class="btn secondary" href="/bases">Change</a></p>`
        : `<p><a class="btn" href="/bases">Choose a base</a></p>`}
      <h2>Scopes granted</h2>
      <p class="muted">${escapeHtml(cfg.airtable?.scope ?? "none")}</p>
    `;
    render(res, req, "Super-admin", body);
  });

  /* -------- OAuth -------- */

  app.get("/auth/login", (req, res) => {
    const auth = buildAuthorizeRequest(oauthCfg);
    const s = getSession(req);
    if (!s) throw new Error("Session not initialized.");
    s.oauth = { codeVerifier: auth.codeVerifier, state: auth.state };
    res.redirect(auth.authorizeUrl);
  });

  app.get("/auth/callback", async (req, res, next) => {
    try {
      const { code, state, error, error_description } = req.query as Record<string, string>;
      if (error) throw new Error(`Airtable returned error: ${error} ${error_description ?? ""}`);
      const s = getSession(req);
      const stash = s?.oauth;
      if (!stash) throw new Error("Session expired; try again.");
      if (state !== stash.state) throw new Error("OAuth state mismatch; possible CSRF.");
      if (!code) throw new Error("Missing code in callback.");
      const token = await exchangeCodeForToken(oauthCfg, code, stash.codeVerifier);
      configStore.update((c) => {
        c.airtable = {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: Date.now() + token.expires_in * 1000,
          tokenType: "Bearer",
          scope: token.scope,
        };
      });
      if (s) {
        s.oauth = undefined;
        s.flash = "Airtable connected successfully.";
      }
      res.redirect("/bases");
    } catch (e) {
      next(e);
    }
  });

  app.post("/auth/logout", (req, res) => {
    configStore.update((c) => {
      delete c.airtable;
      delete c.selectedBase;
    });
    const s = getSession(req);
    if (s) s.flash = "Disconnected and cleared base selection.";
    res.redirect("/");
  });

  /* -------- Bases -------- */

  app.get("/bases", async (req, res, next) => {
    try {
      const cfg = configStore.load();
      if (!cfg.airtable) {
        const s = getSession(req);
        if (s) s.flash = "Connect Airtable first.";
        return res.redirect("/");
      }
      const token = await ensureAccessToken(oauthCfg);
      const client = new AirtableClient(token);
      const bases = await client.listBases();
      const current = cfg.selectedBase?.baseId;
      const body = `
        <p>Select the base that will host your tribunal data. You can choose an existing base or create a new one from the Tribunal schema.</p>
        ${bases.length === 0
          ? `<p class="muted">No bases visible. Make sure you granted access when you signed in, or create a new base below.</p>`
          : `<ul class="bases">
               ${bases
                 .map(
                   (b) => `
                   <li>
                     <form method="post" action="/bases/select" style="flex:1; display:flex; align-items:center; gap:1rem;">
                       <input type="hidden" name="baseId" value="${escapeHtml(b.id)}">
                       <input type="hidden" name="baseName" value="${escapeHtml(b.name)}">
                       <div style="flex:1;">
                         <strong>${escapeHtml(b.name)}</strong> <code>${escapeHtml(b.id)}</code><br>
                         <span class="muted">permission: ${escapeHtml(b.permissionLevel)}</span>
                       </div>
                       <button type="submit">${current === b.id ? "Re-select" : "Select"}</button>
                     </form>
                   </li>`,
                 )
                 .join("")}
             </ul>`}
        <h2>Create a new base from the Tribunal schema</h2>
        <form method="post" action="/bases/create">
          <label>Workspace ID: <input name="workspaceId" placeholder="wspXXXXXXXXXXXXXX" required size="30"></label>
          <button type="submit">Create base</button>
          <p class="muted">Find your workspace ID in the Airtable URL when you're viewing the workspace's home page.</p>
        </form>
        ${cfg.selectedBase
          ? `
          <h2>Provisioning</h2>
          <p>Selected: <strong>${escapeHtml(cfg.selectedBase.baseName)}</strong> <code>${escapeHtml(cfg.selectedBase.baseId)}</code></p>
          <form method="post" action="/bases/provision">
            <button type="submit">Sync schema into this base</button>
            <span class="muted">Adds any missing tables/fields. Never deletes data.</span>
          </form>
          <form method="post" action="/bases/seed-grounds" style="margin-top:.6rem;">
            <button class="secondary" type="submit">Seed canonical grounds of nullity</button>
          </form>`
          : ""}
      `;
      render(res, req, "Bases", body);
    } catch (e) {
      next(e);
    }
  });

  app.post("/bases/select", (req, res) => {
    const { baseId, baseName } = req.body as { baseId?: string; baseName?: string };
    if (!baseId || !baseName) {
      const s = getSession(req);
      if (s) s.flash = "Missing base id or name.";
      return res.redirect("/bases");
    }
    configStore.update((c) => {
      c.selectedBase = {
        baseId,
        baseName,
        tableIds: c.selectedBase?.baseId === baseId ? c.selectedBase.tableIds : {},
        selectedAt: Date.now(),
        ...(c.selectedBase?.baseId === baseId && c.selectedBase?.lastProvisionedAt !== undefined
          ? { lastProvisionedAt: c.selectedBase.lastProvisionedAt }
          : {}),
      };
    });
    const s = getSession(req);
    if (s) s.flash = `Selected "${baseName}".`;
    res.redirect("/");
  });

  app.post("/bases/create", async (req, res, next) => {
    try {
      const { workspaceId } = req.body as { workspaceId?: string };
      if (!workspaceId) throw new Error("workspaceId required.");
      const token = await ensureAccessToken(oauthCfg);
      const client = new AirtableClient(token);
      const result = await provisionNewBase(client, workspaceId);
      configStore.update((c) => {
        c.selectedBase = {
          baseId: result.baseId,
          baseName: result.baseName,
          tableIds: result.tableIds,
          selectedAt: Date.now(),
          lastProvisionedAt: Date.now(),
        };
      });
      const s = getSession(req);
      if (s) s.flash = `Created base "${result.baseName}" with ${result.createdTables.length} tables.`;
      res.redirect("/");
    } catch (e) {
      next(e);
    }
  });

  app.post("/bases/provision", async (req, res, next) => {
    try {
      const cfg = configStore.load();
      if (!cfg.selectedBase) throw new Error("Select a base first.");
      const token = await ensureAccessToken(oauthCfg);
      const client = new AirtableClient(token);
      const result = await provisionExistingBase(client, cfg.selectedBase.baseId);
      configStore.update((c) => {
        if (c.selectedBase) {
          c.selectedBase.tableIds = result.tableIds;
          c.selectedBase.lastProvisionedAt = Date.now();
        }
      });
      const s = getSession(req);
      if (s)
        s.flash = `Synced schema: ${result.createdTables.length} new table(s), ${result.addedFields.length} new field(s), ${result.preexistingTables.length} pre-existing table(s).`;
      res.redirect("/");
    } catch (e) {
      next(e);
    }
  });

  app.post("/bases/seed-grounds", async (req, res, next) => {
    try {
      const cfg = configStore.load();
      if (!cfg.selectedBase) throw new Error("Select a base first.");
      if (!cfg.selectedBase.tableIds["Grounds of Nullity"]) {
        throw new Error("Run 'Sync schema' first so the Grounds of Nullity table exists.");
      }
      const token = await ensureAccessToken(oauthCfg);
      const client = new AirtableClient(token);
      const result = await seedGrounds(client, cfg.selectedBase.baseId, cfg.selectedBase.tableIds);
      const s = getSession(req);
      if (s) s.flash = `Inserted ${result.inserted} grounds of nullity.`;
      res.redirect("/");
    } catch (e) {
      next(e);
    }
  });

  /* -------- Error handler -------- */

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    const body = `
      <p class="flash" style="background:#ffd6d6; border-color:#c00;">
        <strong>Error:</strong> ${escapeHtml(err.message)}
      </p>
      <p><a class="btn secondary" href="/">Back</a></p>
    `;
    res.status(500).type("html").send(layout("Error", body));
  });

  return app;
}

export function startAdminServer(opts: AdminServerOptions = {}): void {
  const port = opts.port ?? Number.parseInt(process.env.PORT ?? "3000", 10);
  const app = createAdminServer(opts);
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Canon Law Tribunal super-admin listening on http://localhost:${port}`);
  });
}
