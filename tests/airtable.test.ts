import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildAuthorizeRequest,
  generatePKCE,
  generateState,
  REQUIRED_SCOPES,
} from "../src/airtable/oauth.ts";
import { ConfigStore } from "../src/airtable/config-store.ts";
import { loadSchemaSpec, loadSeedGrounds } from "../src/airtable/provisioner.ts";

describe("OAuth PKCE helpers", () => {
  it("generates a PKCE pair with correct lengths", () => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    // base64url(32 bytes) = 43 chars
    assert.equal(codeVerifier.length, 43);
    assert.equal(codeChallenge.length, 43);
    assert.doesNotMatch(codeVerifier, /[+/=]/);
    assert.doesNotMatch(codeChallenge, /[+/=]/);
  });

  it("state is random and unpredictable", () => {
    const a = generateState();
    const b = generateState();
    assert.notEqual(a, b);
  });

  it("authorize URL contains required OAuth params", () => {
    const req = buildAuthorizeRequest({
      clientId: "cli_abc",
      redirectUri: "http://localhost:3000/auth/callback",
    });
    const u = new URL(req.authorizeUrl);
    assert.equal(u.origin + u.pathname, "https://airtable.com/oauth2/v1/authorize");
    assert.equal(u.searchParams.get("client_id"), "cli_abc");
    assert.equal(u.searchParams.get("response_type"), "code");
    assert.equal(u.searchParams.get("code_challenge_method"), "S256");
    assert.equal(u.searchParams.get("state"), req.state);
    for (const s of REQUIRED_SCOPES) {
      assert.ok(u.searchParams.get("scope")!.includes(s), `scope missing: ${s}`);
    }
  });
});

describe("encrypted ConfigStore", () => {
  let tmp: string;
  const origDir = process.env.CANONLAW_CONFIG_DIR;
  const origKey = process.env.CANONLAW_MASTER_KEY;

  before(() => {
    tmp = mkdtempSync(join(tmpdir(), "canonlaw-test-"));
    process.env.CANONLAW_CONFIG_DIR = tmp;
    process.env.CANONLAW_MASTER_KEY = "test-key-for-tests-only";
  });
  after(() => {
    rmSync(tmp, { recursive: true, force: true });
    if (origDir === undefined) delete process.env.CANONLAW_CONFIG_DIR;
    else process.env.CANONLAW_CONFIG_DIR = origDir;
    if (origKey === undefined) delete process.env.CANONLAW_MASTER_KEY;
    else process.env.CANONLAW_MASTER_KEY = origKey;
  });

  it("round-trips an airtable token", () => {
    const store = new ConfigStore();
    store.save({
      airtable: {
        accessToken: "at_abc",
        refreshToken: "rt_abc",
        expiresAt: Date.now() + 60_000,
        tokenType: "Bearer",
        scope: "schema.bases:read",
      },
    });
    const fresh = new ConfigStore();
    const loaded = fresh.load();
    assert.equal(loaded.airtable?.accessToken, "at_abc");
    assert.equal(loaded.airtable?.scope, "schema.bases:read");
  });

  it("update() preserves prior fields", () => {
    const store = new ConfigStore();
    store.update((c) => {
      c.selectedBase = {
        baseId: "app1",
        baseName: "Tribunal",
        tableIds: {},
        selectedAt: 1,
      };
    });
    const reloaded = new ConfigStore().load();
    assert.equal(reloaded.selectedBase?.baseId, "app1");
    // airtable creds from prior test are still present.
    assert.equal(reloaded.airtable?.accessToken, "at_abc");
  });

  it("rejects decryption with a different key", () => {
    process.env.CANONLAW_MASTER_KEY = "a-different-key";
    const store = new ConfigStore();
    assert.throws(() => store.load(), /Failed to decrypt/);
    process.env.CANONLAW_MASTER_KEY = "test-key-for-tests-only";
  });
});

describe("provisioner schema loader", () => {
  it("loads the shipped schema with 13 tables", () => {
    const spec = loadSchemaSpec();
    assert.equal(spec.tables.length, 13);
    const names = spec.tables.map((t) => t.name).sort();
    assert.ok(names.includes("Cases"));
    assert.ok(names.includes("Acts"));
    assert.ok(names.includes("Deadlines"));
    assert.ok(names.includes("Tribunal Calendar"));
  });

  it("every link field declares a linkedTableName that resolves", () => {
    const spec = loadSchemaSpec();
    const tableNames = new Set(spec.tables.map((t) => t.name));
    for (const t of spec.tables) {
      for (const f of t.fields) {
        if (f.type !== "multipleRecordLinks") continue;
        const target = f.options?.linkedTableName;
        assert.ok(target, `${t.name}.${f.name} missing linkedTableName`);
        assert.ok(
          tableNames.has(target!),
          `${t.name}.${f.name} → unknown table "${target}"`,
        );
      }
    }
  });

  it("loads 28 seed grounds", () => {
    const g = loadSeedGrounds();
    assert.equal(g.length, 28);
    assert.ok(g.every((x) => x.canonReference.startsWith("c.")));
  });
});
